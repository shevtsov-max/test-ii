import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { shevtsovTree, demoTree, emptyTree } from '@/data/seed'
import { romanovTree } from '@/data/romanovs'
import { newFamily, newPerson, uid } from '@/utils/person'
import * as G from '@/utils/graph'

const LS_TREE = 'ft:tree:v1'
// Отдельный ключ для эксперимента: настройки (режим раскрытия, подписи родства) не смешиваются с основной версией сайта
const LS_UI = 'ft:ui:exp1'
const HISTORY_LIMIT = 60

function load(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const useTreeStore = defineStore('tree', () => {
  const tree = ref(load(LS_TREE) ?? romanovTree())
  const savedUi = load(LS_UI) ?? {}

  const ui = ref({
    generations: 4,
    placeholders: true,
    showPhotos: true,
    showYears: true,
    showRelation: true,
    /** Эксперимент: «Показать предков/потомков» добавляет ветку на месте, а не перестраивает дерево вокруг другой персоны */
    branchMode: true,
    expandUp: [],
    expandDown: [],
    siblings: true,
    compact: false,
    dark: false,
    panelOpen: true,
    view: 'family',
    ...savedUi,
  })

  const firstId = () => tree.value.homePersonId ?? Object.keys(tree.value.persons)[0] ?? null
  const focusId = ref(savedUi.focusId && tree.value.persons[savedUi.focusId] ? savedUi.focusId : firstId())
  const selectedId = ref(savedUi.selectedId && tree.value.persons[savedUi.selectedId] ? savedUi.selectedId : focusId.value)

  // ---------------------------------------------------------------- persistence
  let saveTimer
  const lastSaved = ref(Date.now())
  const saveError = ref(null)
  watch(
    tree,
    () => {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(LS_TREE, JSON.stringify(tree.value))
          lastSaved.value = Date.now()
          saveError.value = null
        } catch (e) {
          saveError.value = 'Не удалось сохранить: хранилище браузера переполнено (слишком много фото?)'
          console.error(e)
        }
      }, 250)
    },
    { deep: true },
  )
  watch(
    [ui, focusId, selectedId],
    () => {
      try {
        localStorage.setItem(LS_UI, JSON.stringify({ ...ui.value, focusId: focusId.value, selectedId: selectedId.value }))
      } catch {
        /* ignore */
      }
    },
    { deep: true },
  )

  // ---------------------------------------------------------------- history
  const past = ref([])
  const future = ref([])
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function snapshot() {
    past.value.push(JSON.stringify(tree.value))
    if (past.value.length > HISTORY_LIMIT) past.value.shift()
    future.value = []
  }
  function restore(raw) {
    tree.value = JSON.parse(raw)
    if (!focusId.value || !tree.value.persons[focusId.value]) focusId.value = firstId()
    if (!selectedId.value || !tree.value.persons[selectedId.value]) selectedId.value = focusId.value
  }
  function undo() {
    const prev = past.value.pop()
    if (!prev) return
    future.value.push(JSON.stringify(tree.value))
    restore(prev)
  }
  function redo() {
    const next = future.value.pop()
    if (!next) return
    past.value.push(JSON.stringify(tree.value))
    restore(next)
  }

  // ---------------------------------------------------------------- getters
  const persons = computed(() => Object.values(tree.value.persons))
  const count = computed(() => persons.value.length)
  const focus = computed(() => (focusId.value ? tree.value.persons[focusId.value] : undefined))
  const selected = computed(() => (selectedId.value ? tree.value.persons[selectedId.value] : undefined))
  const homeId = computed(() => tree.value.homePersonId)

  const person = (id) => (id ? tree.value.persons[id] : undefined)
  const parentsOf = (id) => G.parentsOf(tree.value, id)
  const partnersOf = (id) => G.partnersOf(tree.value, id)
  const childrenOf = (id) => G.childrenOf(tree.value, id)
  const siblingsOf = (id) => G.siblingsOf(tree.value, id)
  const spouseFamilies = (id) => G.spouseFamilies(tree.value, id)
  const relationToHome = (id) => G.relationship(tree.value, tree.value.homePersonId, id)

  const places = computed(() => {
    const s = new Set()
    for (const p of persons.value) {
      if (p.birth.place) s.add(p.birth.place)
      if (p.death.place) s.add(p.death.place)
      for (const f of p.facts) if (f.place) s.add(f.place)
    }
    for (const f of Object.values(tree.value.families)) if (f.marriage.place) s.add(f.marriage.place)
    return [...s].sort((a, b) => a.localeCompare(b, 'ru'))
  })

  /** Какие родственники могут быть добавлены */
  function canAdd(id) {
    const { father, mother, family } = parentsOf(id)
    const full = (family?.partners.length ?? 0) >= 2
    return {
      father: !father && !full,
      mother: !mother && !full,
      brother: true,
      sister: true,
      partner: true,
      son: true,
      daughter: true,
    }
  }

  // ---------------------------------------------------------------- mutations
  function touch(p) {
    p.updatedAt = Date.now()
  }

  function setFocus(id, select = true) {
    if (!tree.value.persons[id]) return
    if (id !== focusId.value) resetBranches()
    focusId.value = id
    if (select) selectedId.value = id
  }
  // ---- ветки, раскрытые кнопками «Показать предков / потомков» (порядок кликов важен: родители раньше их родителей)
  function resetBranches() {
    ui.value.expandUp = []
    ui.value.expandDown = []
  }
  function expandBranch(dir, id) {
    const key = dir === 'up' ? 'expandUp' : 'expandDown'
    if (!ui.value[key].includes(id)) ui.value[key] = [...ui.value[key], id]
  }
  /** Скрывает ветку вместе со всеми раскрытыми в ней подветками. */
  function collapseBranch(dir, id) {
    if (dir === 'up') {
      const branch = G.ancestorsWithDistance(tree.value, id)
      ui.value.expandUp = ui.value.expandUp.filter((x) => !branch.has(x))
    } else {
      const branch = new Set([id])
      const queue = [id]
      while (queue.length) for (const k of G.childrenOf(tree.value, queue.shift())) if (!branch.has(k)) (branch.add(k), queue.push(k))
      ui.value.expandDown = ui.value.expandDown.filter((x) => !branch.has(x))
    }
  }
  function select(id) {
    selectedId.value = id
  }

  function setHome(id) {
    snapshot()
    tree.value.homePersonId = id
  }

  function renameTree(name) {
    snapshot()
    tree.value.name = name
  }

  function updatePerson(id, patch) {
    const p = tree.value.persons[id]
    if (!p) return
    snapshot()
    Object.assign(p, JSON.parse(JSON.stringify(patch)))
    touch(p)
  }

  function addRelative(targetId, kind, data, opts = {}) {
    const t = tree.value
    if (!t.persons[targetId]) throw new Error('Персона не найдена')
    const before = JSON.stringify(t)
    snapshot()
    try {
      return addRelativeUnsafe(targetId, kind, data, opts)
    } catch (e) {
      past.value.pop()
      tree.value = JSON.parse(before)
      throw e
    }
  }

  function addRelativeUnsafe(targetId, kind, data, opts) {
    const t = tree.value
    let pid
    if (opts.existingId) {
      if (!t.persons[opts.existingId]) throw new Error('Персона не найдена')
      if (opts.existingId === targetId) throw new Error('Нельзя связать персону саму с собой')
      pid = opts.existingId
    } else {
      const gender =
        kind === 'father' || kind === 'brother' || kind === 'son'
          ? 'M'
          : kind === 'mother' || kind === 'sister' || kind === 'daughter'
            ? 'F'
            : (data.gender ?? 'U')
      const p = newPerson({ ...JSON.parse(JSON.stringify(data)), gender: data.gender ?? gender })
      t.persons[p.id] = p
      pid = p.id
    }

    const addFamily = (f) => {
      t.families[f.id] = f
      return f
    }

    switch (kind) {
      case 'father':
      case 'mother': {
        let pf = G.parentFamily(t, targetId)
        if (!pf) pf = addFamily(newFamily({ partners: [], children: [targetId] }))
        if (pf.partners.length >= 2) throw new Error('У персоны уже есть оба родителя')
        if (pf.partners.includes(pid)) break
        // Если новый родитель уже в паре с существующим родителем — переносим ребёнка в ту семью
        const existingPartner = pf.partners[0]
        if (existingPartner && opts.existingId) {
          const both = Object.values(t.families).find(
            (f) => f.id !== pf.id && f.partners.includes(existingPartner) && f.partners.includes(pid),
          )
          if (both) {
            pf.children = pf.children.filter((c) => c !== targetId)
            both.children.push(targetId)
            cleanupFamilies()
            break
          }
        }
        pf.partners.push(pid)
        break
      }
      case 'son':
      case 'daughter': {
        if (opts.existingId && G.parentFamily(t, pid)) {
          const pf = G.parentFamily(t, pid)
          if (pf.partners.length >= 2) throw new Error('У выбранной персоны уже есть оба родителя')
          if (!pf.partners.includes(targetId)) pf.partners.push(targetId)
          break
        }
        let fam
        if (opts.familyId && t.families[opts.familyId]) fam = t.families[opts.familyId]
        else {
          // семья с одним родителем
          fam = Object.values(t.families).find((f) => f.partners.length === 1 && f.partners[0] === targetId)
          if (!fam) fam = addFamily(newFamily({ partners: [targetId], status: 'unknown' }))
        }
        if (!fam.children.includes(pid)) fam.children.push(pid)
        break
      }
      case 'brother':
      case 'sister': {
        if (opts.existingId && G.parentFamily(t, pid)) throw new Error('У выбранной персоны уже есть родители')
        let fam
        if (opts.familyId && t.families[opts.familyId]) fam = t.families[opts.familyId]
        else fam = G.parentFamily(t, targetId)
        if (!fam) fam = addFamily(newFamily({ partners: [], children: [targetId], status: 'unknown' }))
        if (!fam.children.includes(pid)) fam.children.push(pid)
        break
      }
      case 'partner': {
        const exists = Object.values(t.families).find((f) => f.partners.includes(targetId) && f.partners.includes(pid))
        if (exists) throw new Error('Эти персоны уже связаны как партнёры')
        // Если у персоны есть «семья с одним родителем» с детьми — предложено объединить (familyId)
        if (opts.familyId && t.families[opts.familyId] && t.families[opts.familyId].partners.length === 1) {
          t.families[opts.familyId].partners.push(pid)
          t.families[opts.familyId].status = opts.status ?? 'married'
        } else addFamily(newFamily({ partners: [targetId, pid], status: opts.status ?? 'married' }))
        break
      }
    }
    return pid
  }

  function cleanupFamilies() {
    const t = tree.value
    for (const f of Object.values(t.families)) {
      f.partners = f.partners.filter((p) => t.persons[p])
      f.children = f.children.filter((c) => t.persons[c])
      const n = f.partners.length
      const c = f.children.length
      if ((n === 0 && c <= 1) || (n === 1 && c === 0)) delete t.families[f.id]
    }
  }

  function deletePerson(id) {
    const t = tree.value
    if (!t.persons[id]) return
    snapshot()
    // кого показать после удаления
    const neighbours = [
      ...G.childrenOf(t, id),
      ...G.partnersOf(t, id).map((x) => x.id),
      ...Object.values(G.parentsOf(t, id)).filter((x) => typeof x === 'string'),
      ...G.siblingsOf(t, id).full,
    ]
    delete t.persons[id]
    for (const f of Object.values(t.families)) {
      f.partners = f.partners.filter((p) => p !== id)
      f.children = f.children.filter((c) => c !== id)
    }
    cleanupFamilies()
    const fallback = neighbours.find((n) => t.persons[n]) ?? firstId()
    if (t.homePersonId === id) t.homePersonId = fallback
    if (focusId.value === id) focusId.value = fallback
    if (selectedId.value === id) selectedId.value = fallback
  }

  function updateFamily(id, patch) {
    const f = tree.value.families[id]
    if (!f) return
    snapshot()
    Object.assign(f, JSON.parse(JSON.stringify(patch)))
  }

  /** Разорвать связь «партнёры» (дети остаются с первым партнёром) */
  function removePartnership(familyId, keepId) {
    const f = tree.value.families[familyId]
    if (!f) return
    snapshot()
    if (!f.children.length) delete tree.value.families[familyId]
    else f.partners = f.partners.filter((p) => p === keepId)
    cleanupFamilies()
  }

  /** Отвязать ребёнка от родителей */
  function detachChild(childId) {
    const f = G.parentFamily(tree.value, childId)
    if (!f) return
    snapshot()
    f.children = f.children.filter((c) => c !== childId)
    cleanupFamilies()
  }

  // Фото
  function addPhoto(pid, src, caption = '', asAvatar = false) {
    const p = tree.value.persons[pid]
    if (!p) return
    snapshot()
    const photo = { id: uid('ph'), src, caption, addedAt: Date.now() }
    p.photos.push(photo)
    if (asAvatar || !p.avatarId) p.avatarId = photo.id
    touch(p)
    return photo.id
  }
  function removePhoto(pid, photoId) {
    const p = tree.value.persons[pid]
    if (!p) return
    snapshot()
    p.photos = p.photos.filter((x) => x.id !== photoId)
    if (p.avatarId === photoId) p.avatarId = p.photos[0]?.id ?? null
    touch(p)
  }
  function setAvatar(pid, photoId) {
    const p = tree.value.persons[pid]
    if (!p) return
    snapshot()
    p.avatarId = photoId
    touch(p)
  }
  function updatePhoto(pid, photoId, caption) {
    const p = tree.value.persons[pid]
    const ph = p?.photos.find((x) => x.id === photoId)
    if (!ph) return
    snapshot()
    ph.caption = caption
  }
  const avatarOf = (p) => (p?.avatarId ? p.photos.find((x) => x.id === p.avatarId)?.src : undefined)

  // Факты
  function saveFact(pid, fact) {
    const p = tree.value.persons[pid]
    if (!p) return
    snapshot()
    const i = p.facts.findIndex((f) => f.id === fact.id)
    const copy = JSON.parse(JSON.stringify(fact))
    if (i >= 0) p.facts[i] = copy
    else p.facts.push(copy)
    touch(p)
  }
  function removeFact(pid, factId) {
    const p = tree.value.persons[pid]
    if (!p) return
    snapshot()
    p.facts = p.facts.filter((f) => f.id !== factId)
    touch(p)
  }

  // Целое древо
  function replaceTree(data) {
    snapshot()
    tree.value = data
    focusId.value = data.homePersonId ?? Object.keys(data.persons)[0] ?? null
    selectedId.value = focusId.value
    resetBranches()
  }
  const loadDemo = () => replaceTree(demoTree())
  const loadOriginal = () => replaceTree(shevtsovTree())
  const loadRomanovs = () => replaceTree(romanovTree())
  const newTree = () => replaceTree(emptyTree())

  return {
    tree,
    ui,
    focusId,
    selectedId,
    lastSaved,
    saveError,
    // history
    undo,
    redo,
    canUndo,
    canRedo,
    // getters
    persons,
    count,
    focus,
    selected,
    homeId,
    places,
    person,
    parentsOf,
    partnersOf,
    childrenOf,
    siblingsOf,
    spouseFamilies,
    relationToHome,
    canAdd,
    avatarOf,
    // actions
    setFocus, expandBranch, collapseBranch, resetBranches,
    select,
    setHome,
    renameTree,
    updatePerson,
    addRelative,
    deletePerson,
    updateFamily,
    removePartnership,
    detachChild,
    addPhoto,
    removePhoto,
    setAvatar,
    updatePhoto,
    saveFact,
    removeFact,
    replaceTree,
    loadDemo,
    loadOriginal,
    loadRomanovs,
    newTree,
  }
})
