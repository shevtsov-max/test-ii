import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'
import { markLegacyImported, readLegacyTree } from '@/app/legacy'
import { demoTree, emptyTree } from '@/data/seed'
import { romanovTree } from '@/data/romanovs'
import { uid } from '@/domain/model'
import { readTreeFile } from '@/utils/backup'
import { useAuthStore } from './auth'

export const EXAMPLES = [
  { id: 'romanovs', name: 'Романовы и европейские династии', text: '72 человека, несколько браков, сводные братья, «схлопывание» предков', make: romanovTree },
  { id: 'demo', name: 'Семья Орловых', text: '25 человек в пяти поколениях — простой пример', make: demoTree },
]

/** Список древ пользователя (главная страница). */
export const useTreesStore = defineStore('trees', () => {
  const auth = useAuthStore()
  /** @type {import('vue').Ref<import('@/domain/types').TreeSummary[]>} */
  const list = ref([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref(null)
  /** Центр древа из прежней версии — применяется при первом открытии */
  const legacyFocus = ref(null)

  async function fetch() {
    if (!auth.user) return
    loading.value = true
    error.value = null
    try {
      await importLegacy()
      list.value = await api.trees.list(auth.user.id)
      loaded.value = true
    } catch (e) {
      error.value = e
      throw e
    } finally {
      loading.value = false
    }
  }

  async function importLegacy() {
    const legacy = readLegacyTree()
    if (!legacy) return
    const s = await api.trees.create(auth.user.id, { ...legacy.tree, id: uid('t') })
    legacyFocus.value = legacy.focusId ? { treeId: s.id, focusId: legacy.focusId } : null
    markLegacyImported()
  }

  async function add(data) {
    const s = await api.trees.create(auth.user.id, data)
    list.value = [s, ...list.value.filter((x) => x.id !== s.id)]
    return s
  }

  /** Новое древо, начатое с себя. */
  function createEmpty(name, me) {
    return add(emptyTree(name || 'Моё семейное древо', me))
  }

  function createExample(exampleId) {
    const ex = EXAMPLES.find((x) => x.id === exampleId) ?? EXAMPLES[0]
    return add({ ...ex.make(), id: uid('t') })
  }

  async function importFile(file) {
    const tree = await readTreeFile(file)
    return add({ ...tree, id: uid('t') })
  }

  async function remove(id) {
    await api.trees.remove(id)
    list.value = list.value.filter((x) => x.id !== id)
  }

  async function rename(id, name) {
    await api.trees.rename(id, name)
    const s = list.value.find((x) => x.id === id)
    if (s) s.name = name
  }

  async function duplicate(id) {
    const { tree } = await api.trees.get(id, auth.user.id)
    return add({ ...tree, id: uid('t'), name: `${tree.name} (копия)` })
  }

  /** Обновить сведения о древе в списке после сохранения. */
  function patchSummary(id, patch) {
    const s = list.value.find((x) => x.id === id)
    if (s) Object.assign(s, patch)
  }

  function reset() {
    list.value = []
    loaded.value = false
  }

  return { list, loading, loaded, error, legacyFocus, fetch, add, createEmpty, createExample, importFile, remove, rename, duplicate, patchSummary, reset }
})
