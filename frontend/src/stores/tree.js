import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { enablePatches, freeze, produceWithPatches } from 'immer'
import { Notify } from 'quasar'
import { api, ApiError, errorMessage } from '@/api'
import { changesToInput, collectChanges, COLLECTIONS, emptyChanges, hasChanges } from '@/api/changes'
import * as A from '@/domain/actions'
import { FamilyGraph } from '@/domain/graph'
import { applyBranches, branchPersonIds, touchesLocked } from '@/domain/branches'
import { relationship } from '@/domain/kinship'
import { ensurePlace, findPlaceByName } from '@/domain/places'
import { useAuthStore } from './auth'
import { useTreesStore } from './trees'

enablePatches()

const LOCKED_MESSAGE = 'Эта ветка передана родственнику и доступна только для просмотра. Чтобы изменить её, склонируйте ветку себе.'
const noLocks = () => ({ persons: new Set(), families: new Set(), media: new Set() })

const HISTORY_LIMIT = 80
const SAVE_DELAY = 500
const VIEW_KEY = (id) => `rd:view:${id}`

/**
 * Открытое древо: данные (неизменяемые, через immer), граф связей, отмена/повтор,
 * автосохранение через api, выбранная и центральная персоны.
 *
 * Все изменения идут через `commit(label, recipe)` или действия ниже — так работают
 * отмена, сохранение и синхронизация с сервером.
 */
export const useTreeStore = defineStore('tree', () => {
  const auth = useAuthStore()
  const treesStore = useTreesStore()

  const treeId = ref(null)
  /** @type {import('vue').ShallowRef<import('@/domain/types').TreeData | null>} */
  const tree = shallowRef(null)
  const role = ref('owner')
  const status = ref('idle')
  const error = ref(null)
  const saveState = ref('saved')
  const saveError = ref('')
  const lastSavedAt = ref(null)
  const version = ref(null)

  const past = shallowRef([])
  const future = shallowRef([])

  /** Передачи веток родственникам (с сервером) и закрытые для правки данные — см. src/domain/branches.js */
  const delegations = ref([])
  const locks = shallowRef(noLocks())
  /** id персоны → id передачи, в которую она входит */
  const lockOwner = shallowRef({})

  const focusId = ref(null)
  const selectedId = ref(null)
  const recent = ref([])
  /** История центра древа — кнопки «Назад» и «Вперёд» */
  const focusHistory = ref({ back: [], forward: [] })

  const graph = computed(() => (tree.value ? new FamilyGraph(tree.value) : null))
  const readonly = computed(() => role.value === 'viewer')
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const undoLabel = computed(() => past.value.at(-1)?.label ?? '')
  const redoLabel = computed(() => future.value.at(-1)?.label ?? '')

  const persons = computed(() => (tree.value ? Object.values(tree.value.persons) : []))
  const count = computed(() => persons.value.length)
  const homeId = computed(() => tree.value?.homePersonId ?? null)
  const person = (id) => (id && tree.value ? tree.value.persons[id] : undefined)
  const family = (id) => (id && tree.value ? tree.value.families[id] : undefined)
  const focus = computed(() => person(focusId.value))
  const selected = computed(() => person(selectedId.value))
  /** Персона из ветки, переданной родственнику: только просмотр. */
  const isLocked = (id) => locks.value.persons.has(id)
  /** Можно ли менять персону и добавлять к ней родственников. */
  const canEdit = (id) => !readonly.value && !isLocked(id)
  /** Принятая передача, в которую входит персона. */
  const delegationOf = (id) => (lockOwner.value[id] ? (delegations.value.find((d) => d.id === lockOwner.value[id]) ?? null) : null)
  /** Приглашение, которое ждёт ответа и захватывает эту персону. */
  const pendingDelegationOf = (id) =>
    tree.value ? (delegations.value.find((d) => d.status === 'pending' && branchPersonIds(tree.value, d.rootPersonId).includes(id)) ?? null) : null
  /** Кем персона приходится «Вам» (домашней персоне). */
  const relationToHome = (id) => (graph.value && homeId.value ? relationship(graph.value, homeId.value, id) : '')

  // ---------------------------------------------------------------- открытие
  let loadToken = 0
  async function open(id) {
    if (treeId.value === id && tree.value) return
    await close()
    const my = ++loadToken
    treeId.value = id
    status.value = 'loading'
    error.value = null
    try {
      const res = await fetchTree(id)
      if (my !== loadToken) return
      tree.value = res.tree
      role.value = res.role ?? 'owner'
      version.value = res.version
      past.value = []
      future.value = []
      restoreView()
      status.value = 'ready'
      saveState.value = 'saved'
    } catch (e) {
      if (my !== loadToken) return
      error.value = e
      status.value = 'error'
    }
  }

  /**
   * Загрузить древо; с сервером — вместе с переданными ветками (их актуальные данные из древ родственников).
   * @returns {Promise<{ tree: import('@/domain/types').TreeData, role: string, version: number }>}
   */
  async function fetchTree(id) {
    const [res, list, branches] = await Promise.all([
      api.trees.get(id, auth.user?.id),
      api.capabilities.delegation ? api.delegations.list(id).catch(() => []) : [],
      api.capabilities.delegation ? api.delegations.branches(id).catch(() => []) : [],
    ])
    const active = list.filter((d) => d.status === 'active')
    const merged = applyBranches(res.tree, branches, active)
    delegations.value = list
    locks.value = merged.locked
    lockOwner.value = merged.owner
    return { ...res, tree: freeze(merged.tree, true) }
  }

  /** Перечитать список передач (после создания или отзыва приглашения). */
  async function refreshDelegations() {
    if (!treeId.value || !api.capabilities.delegation) return
    delegations.value = await api.delegations.list(treeId.value)
  }

  async function close() {
    if (treeId.value) await flush()
    loadToken++
    delegations.value = []
    locks.value = noLocks()
    lockOwner.value = {}
    tree.value = null
    treeId.value = null
    status.value = 'idle'
    past.value = []
    future.value = []
    focusId.value = selectedId.value = null
    recent.value = []
    focusHistory.value = { back: [], forward: [] }
  }

  function restoreView() {
    const t = tree.value
    let v = {}
    try {
      v = JSON.parse(localStorage.getItem(VIEW_KEY(treeId.value)) ?? '{}')
    } catch {
      /* ignore */
    }
    const legacy = treesStore.legacyFocus
    if (legacy?.treeId === treeId.value) {
      v.focusId = legacy.focusId
      treesStore.legacyFocus = null
    }
    const first = t.homePersonId ?? Object.keys(t.persons)[0] ?? null
    focusId.value = v.focusId && t.persons[v.focusId] ? v.focusId : first
    selectedId.value = v.selectedId && t.persons[v.selectedId] ? v.selectedId : focusId.value
    recent.value = (v.recent ?? []).filter((x) => t.persons[x])
  }
  watch([focusId, selectedId, recent], () => {
    if (!treeId.value) return
    try {
      localStorage.setItem(VIEW_KEY(treeId.value), JSON.stringify({ focusId: focusId.value, selectedId: selectedId.value, recent: recent.value }))
    } catch {
      /* ignore */
    }
  })

  // ---------------------------------------------------------------- сохранение
  let outbox = emptyChanges()
  let saveTimer = null
  let retryTimer = null
  let saving = null

  function schedule() {
    saveState.value = 'pending'
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => flush(), SAVE_DELAY)
  }

  async function flush() {
    clearTimeout(saveTimer)
    if (saving) await saving
    if (!treeId.value || !tree.value || !hasChanges(outbox)) return
    const acc = outbox
    outbox = emptyChanges()
    const id = treeId.value
    const snapshot = tree.value
    saveState.value = 'saving'
    saving = (async () => {
      try {
        const input = api.mode === 'graphql' ? changesToInput(acc, snapshot, version.value) : null
        const r = await api.trees.save(id, snapshot, input)
        if (treeId.value !== id) return
        version.value = r.version
        lastSavedAt.value = Date.now()
        saveError.value = ''
        saveState.value = hasChanges(outbox) ? 'pending' : 'saved'
        channel?.postMessage({ type: 'saved', treeId: id, version: r.version })
        treesStore.patchSummary(id, { name: snapshot.name, persons: Object.keys(snapshot.persons).length, updatedAt: r.updatedAt })
        if (hasChanges(outbox)) schedule()
      } catch (e) {
        // Вернуть несохранённое в очередь и повторить позже
        mergeInto(outbox, acc)
        saveError.value = errorMessage(e)
        saveState.value = e.code === 'NETWORK' ? 'offline' : 'error'
        clearTimeout(retryTimer)
        retryTimer = setTimeout(() => flush(), e.code === 'NETWORK' ? 8000 : 20000)
        if (e.code === 'CONFLICT') reloadFromServer()
      } finally {
        saving = null
      }
    })()
    return saving
  }

  function mergeInto(target, src) {
    if (src.full) target.full = true
    for (const k of src.tree) target.tree.add(k)
    for (const c of COLLECTIONS) {
      for (const id of src.upsert[c]) if (!target.remove[c].has(id)) target.upsert[c].add(id)
      for (const id of src.remove[c]) if (!target.upsert[c].has(id)) target.remove[c].add(id)
    }
  }

  async function reloadFromServer() {
    if (!treeId.value) return
    const res = await fetchTree(treeId.value)
    tree.value = res.tree
    version.value = res.version
    past.value = []
    future.value = []
    outbox = emptyChanges()
    saveState.value = 'saved'
    if (!tree.value.persons[focusId.value]) restoreView()
  }

  // Другие вкладки с тем же древом
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('rodoslovnaya-trees') : null
  const externalChange = ref(false)
  channel?.addEventListener('message', (ev) => {
    const m = ev.data
    if (m?.type !== 'saved' || m.treeId !== treeId.value || m.version === version.value) return
    if (!hasChanges(outbox) && saveState.value !== 'saving') reloadFromServer()
    else externalChange.value = true
  })
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', (e) => {
      if (hasChanges(outbox) || saving) {
        flush()
        e.preventDefault()
      }
    })
    window.addEventListener('online', () => saveState.value === 'offline' && flush())
  }

  // ---------------------------------------------------------------- изменения и история
  /**
   * Изменить древо. recipe получает immer-черновик; результат recipe не возвращается —
   * значения передавайте через замыкание.
   * @param {string} label подпись для «Отменить: …»
   * @param {(draft: import('@/domain/types').TreeData) => void} recipe
   */
  function commit(label, recipe) {
    if (!tree.value) throw new ApiError('Древо не открыто', 'NOT_FOUND')
    if (readonly.value) throw new ApiError('У вас доступ только для просмотра', 'FORBIDDEN')
    const [next, patches] = produceWithPatches(tree.value, (d) => {
      recipe(d)
    })
    if (!patches.length) return false
    if (touchesLocked(patches, locks.value, tree.value, next)) {
      Notify.create({ icon: 'sym_r_lock', message: LOCKED_MESSAGE, timeout: 5000 })
      throw new ApiError(LOCKED_MESSAGE, 'FORBIDDEN')
    }
    const stamped = { ...next, updatedAt: Date.now() }
    past.value = [...past.value.slice(-(HISTORY_LIMIT - 1)), { tree: tree.value, label }]
    future.value = []
    tree.value = Object.freeze(stamped)
    collectChanges(outbox, patches)
    afterChange()
    schedule()
    return true
  }

  /** Отметить в очереди изменений разницу между двумя состояниями (для отмены/повтора). */
  function diffInto(a, b) {
    for (const c of COLLECTIONS) {
      const A_ = a[c] ?? {}
      const B_ = b[c] ?? {}
      for (const id of Object.keys(B_)) if (A_[id] !== B_[id]) collectChanges(outbox, [{ op: 'replace', path: [c, id] }])
      for (const id of Object.keys(A_)) if (!B_[id]) collectChanges(outbox, [{ op: 'remove', path: [c, id] }])
    }
    for (const k of ['name', 'description', 'homePersonId', 'customFields']) if (a[k] !== b[k]) outbox.tree.add(k)
  }

  function undo() {
    const prev = past.value.at(-1)
    if (!prev || readonly.value) return
    past.value = past.value.slice(0, -1)
    future.value = [...future.value, { tree: tree.value, label: prev.label }]
    diffInto(tree.value, prev.tree)
    tree.value = prev.tree
    afterChange()
    schedule()
    return prev.label
  }
  function redo() {
    const next = future.value.at(-1)
    if (!next || readonly.value) return
    future.value = future.value.slice(0, -1)
    past.value = [...past.value, { tree: tree.value, label: next.label }]
    diffInto(tree.value, next.tree)
    tree.value = next.tree
    afterChange()
    schedule()
    return next.label
  }

  function afterChange() {
    const t = tree.value
    if (focusId.value && !t.persons[focusId.value]) focusId.value = t.homePersonId ?? Object.keys(t.persons)[0] ?? null
    if (selectedId.value && !t.persons[selectedId.value]) selectedId.value = focusId.value
    if (recent.value.some((x) => !t.persons[x])) recent.value = recent.value.filter((x) => t.persons[x])
  }

  // ---------------------------------------------------------------- выбор
  function setFocus(id, select = true) {
    if (!person(id)) return
    if (focusId.value && focusId.value !== id) {
      focusHistory.value = { back: [...focusHistory.value.back, focusId.value].slice(-50), forward: [] }
    }
    focusId.value = id
    if (select) selectPerson(id)
  }
  const alive = (ids) => ids.filter((x) => person(x) && x !== focusId.value)
  const canFocusBack = computed(() => alive(focusHistory.value.back).length > 0)
  const canFocusForward = computed(() => alive(focusHistory.value.forward).length > 0)
  /** Вернуться к предыдущему центру древа. */
  function focusBack() {
    const back = alive(focusHistory.value.back)
    const id = back.pop()
    if (!id) return
    focusHistory.value = { back, forward: [...focusHistory.value.forward, focusId.value].filter(Boolean) }
    focusId.value = id
    selectPerson(id)
  }
  function focusForward() {
    const forward = alive(focusHistory.value.forward)
    const id = forward.pop()
    if (!id) return
    focusHistory.value = { back: [...focusHistory.value.back, focusId.value].filter(Boolean), forward }
    focusId.value = id
    selectPerson(id)
  }
  // Раздел «Древо» открывается от «Это Вы». Исключение — переход «Показать в древе» с конкретной персоной.
  let chartIntent = false
  /** Центр древа — эта персона, и раздел «Древо» не сбросит его при открытии. */
  function focusForChart(id) {
    setFocus(id)
    chartIntent = true
  }
  /** Был ли запрошен конкретный центр (флаг сбрасывается при чтении). */
  function takeChartIntent() {
    const v = chartIntent
    chartIntent = false
    return v
  }
  /** Как при первом открытии: в центре и выбрана «Это Вы», история переходов очищена. */
  function resetView() {
    const t = tree.value
    if (!t) return
    const id = t.homePersonId && t.persons[t.homePersonId] ? t.homePersonId : (Object.keys(t.persons)[0] ?? null)
    focusId.value = id
    focusHistory.value = { back: [], forward: [] }
    if (id) selectPerson(id)
  }
  function selectPerson(id) {
    if (id && !person(id)) return
    selectedId.value = id
    if (id) recent.value = [id, ...recent.value.filter((x) => x !== id)].slice(0, 12)
  }

  // ---------------------------------------------------------------- действия
  let result
  const run = (label, fn) => {
    result = undefined
    commit(label, (d) => {
      result = fn(d)
    })
    return result
  }

  // ---------------------------------------------------------------- передача веток
  /**
   * Передать ветку родственнику: приглашение на почту и/или ссылка.
   * @returns {Promise<{ link: string, delegation: object }>}
   */
  async function delegate(rootPersonId, { email, message } = {}) {
    await flush()
    const r = await api.delegations.create(treeId.value, rootPersonId, { email, message })
    await refreshDelegations()
    return r
  }
  async function revokeDelegation(id) {
    await api.delegations.revoke(id)
    await refreshDelegations()
  }
  /** Скопировать ветку из древа родственника себе: дальше её можно править, у родственника ничего не меняется. */
  async function cloneDelegation(id) {
    await flush()
    await api.delegations.clone(id)
    await reloadFromServer()
    treesStore.fetch().catch(() => {})
  }

  const actions = {
    setHome: (id) => run('«Это Вы»', (d) => void (d.homePersonId = id)),
    updateInfo: (patch) =>
      run('Сведения о древе', (d) => {
        if (patch.name !== undefined) d.name = patch.name
        if (patch.description !== undefined) d.description = patch.description
      }),
    addPerson: (data) => run('Новая персона', (d) => A.addPerson(d, data)),
    updatePerson: (id, patch, label = 'Изменение персоны') => run(label, (d) => A.updatePerson(d, id, patch)),
    toggleFavorite: (id) => run('Избранное', (d) => void (d.persons[id] && (d.persons[id].favorite = !d.persons[id].favorite))),
    deletePerson: (id) => run('Удаление персоны', (d) => A.deletePerson(d, id)),
    addRelative: (targetId, kind, data, opts) => run('Добавление родственника', (d) => A.addRelative(d, targetId, kind, data, opts)),
    addParentFamily: (childId, link) => run('Новые родители', (d) => A.addParentFamily(d, childId, link)),
    updateFamily: (id, patch) => run('Изменение отношений', (d) => A.updateFamily(d, id, patch)),
    removePartnership: (familyId, keepId) => run('Удаление связи', (d) => A.removePartnership(d, familyId, keepId)),
    detachChild: (childId, familyId) => run('Отвязка от родителей', (d) => A.detachChild(d, childId, familyId)),
    setChildLink: (familyId, childId, link) => run('Тип родства', (d) => A.setChildLink(d, familyId, childId, link)),
    moveChild: (childId, from, to) => run('Смена родителей', (d) => A.moveChild(d, childId, from, to)),
    saveEvent: (pid, ev) => run('Событие', (d) => A.saveEvent(d, pid, ev)),
    removeEvent: (pid, eventId) => run('Удаление события', (d) => A.removeEvent(d, pid, eventId)),
    /** Найти или создать место по тексту. */
    ensurePlace: (text) => {
      const s = text?.trim()
      if (!s) return null
      const found = findPlaceByName(tree.value, s)
      return found ? found.id : run('Новое место', (d) => ensurePlace(d, s))
    },
    savePlace: (place) => run('Место', (d) => A.savePlace(d, place)),
    removePlace: (id, replaceWith) => run('Удаление места', (d) => A.removePlace(d, id, replaceWith)),
    mergePlaces: (keepId, dropId) => run('Объединение мест', (d) => A.mergePlaces(d, keepId, dropId)),
    addMedia: (items) => run(items.length > 1 ? 'Добавление файлов' : 'Добавление файла', (d) => A.addMedia(d, items)),
    updateMedia: (id, patch) => run('Изменение файла', (d) => A.updateMedia(d, id, patch)),
    removeMedia: (id) => {
      const m = tree.value?.media[id]
      const ok = run('Удаление файла', (d) => A.removeMedia(d, id))
      if (m?.fileKey) setTimeout(() => api.media.remove(m.fileKey).catch(() => {}), 60000)
      return ok
    },
    setAvatar: (pid, mediaId) => run('Главное фото', (d) => A.setAvatar(d, pid, mediaId)),
    linkMedia: (mediaId, pid, on) => run(on ? 'Отметка на фото' : 'Снятие отметки', (d) => A.linkMedia(d, mediaId, pid, on)),
    saveSource: (s) => run('Источник', (d) => A.saveSource(d, s)),
    removeSource: (id) => run('Удаление источника', (d) => A.removeSource(d, id)),
    saveClan: (c) => run('Род', (d) => A.saveClan(d, c)),
    removeClan: (id) => run('Удаление рода', (d) => A.removeClan(d, id)),
    assignClan: (ids, clanId) => run('Род', (d) => A.assignClan(d, ids, clanId)),
    saveCustomField: (def) => run('Дополнительное поле', (d) => A.saveCustomField(d, def)),
    removeCustomField: (id) => run('Удаление поля', (d) => A.removeCustomField(d, id)),
    mergePersons: (keepId, dropId) => run('Объединение персон', (d) => A.mergePersons(d, keepId, dropId)),
    /** Заменить содержимое древа (импорт в открытое древо). */
    replaceData: (data) =>
      run('Импорт', (d) => {
        for (const k of ['persons', 'families', 'places', 'media', 'sources', 'clans', 'customFields', 'homePersonId']) d[k] = data[k]
      }),
  }

  return {
    // состояние
    treeId,
    tree,
    role,
    status,
    error,
    saveState,
    saveError,
    lastSavedAt,
    externalChange,
    graph,
    readonly,
    delegations,
    locks,
    isLocked,
    canEdit,
    delegationOf,
    pendingDelegationOf,
    focusId,
    selectedId,
    recent,
    focusHistory,
    canFocusBack,
    canFocusForward,
    // производные
    persons,
    count,
    homeId,
    focus,
    selected,
    person,
    family,
    relationToHome,
    // история
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    undo,
    redo,
    // жизненный цикл
    open,
    close,
    flush,
    reloadFromServer,
    refreshDelegations,
    delegate,
    revokeDelegation,
    cloneDelegation,
    commit,
    setFocus,
    focusBack,
    focusForward,
    selectPerson,
    focusForChart,
    takeChartIntent,
    resetView,
    ...actions,
  }
})
