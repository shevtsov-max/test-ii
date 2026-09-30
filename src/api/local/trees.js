/**
 * Древа в IndexedDB. Каждое сохранение пишет древо целиком (изменения `changes` нужны только серверу).
 */
import { ApiError } from '../errors'
import { summarize } from '../summary'
import { store } from './db'
import { uid } from '@/domain/model'

export const trees = {
  /** @returns {Promise<import('@/domain/types').TreeSummary[]>} */
  async list(userId) {
    const list = await store.byIndex('summaries', 'ownerId', userId)
    return list.sort((a, b) => b.updatedAt - a.updatedAt)
  },

  async get(treeId, userId) {
    const s = await store.get('summaries', treeId)
    if (!s || (userId && s.ownerId !== userId)) throw new ApiError('Древо не найдено', 'NOT_FOUND')
    const t = await store.get('trees', treeId)
    if (!t) throw new ApiError('Древо не найдено', 'NOT_FOUND')
    return { tree: t, role: s.role ?? 'owner', version: t.updatedAt }
  },

  /** Создаёт древо из готовых данных (новое, импорт, пример). */
  async create(userId, data) {
    const id = data.id && !(await store.get('trees', data.id)) ? data.id : uid('t')
    // JSON-копия: снимает реактивные прокси Vue, которые IndexedDB не умеет клонировать
    const tree = { ...JSON.parse(JSON.stringify(data)), id, createdAt: Date.now(), updatedAt: Date.now() }
    await store.put('trees', tree)
    const s = summarize(tree, userId)
    await store.put('summaries', s)
    return s
  },

  /**
   * @param {string} treeId
   * @param {import('@/domain/types').TreeData} tree
   * @param {object} [_changes] изменения (используются только сервером)
   */
  async save(treeId, tree, _changes) {
    const s = await store.get('summaries', treeId)
    if (!s) throw new ApiError('Древо удалено', 'NOT_FOUND')
    const updatedAt = Date.now()
    const next = { ...tree, updatedAt }
    await store.put('trees', next)
    await store.put('summaries', summarize(next, s.ownerId, s.role))
    return { version: updatedAt, updatedAt }
  },

  async rename(treeId, name) {
    const t = await store.get('trees', treeId)
    if (!t) throw new ApiError('Древо не найдено', 'NOT_FOUND')
    return trees.save(treeId, { ...t, name })
  },

  async remove(treeId) {
    const t = await store.get('trees', treeId)
    for (const m of Object.values(t?.media ?? {})) if (m.fileKey) await store.delete('files', m.fileKey)
    await store.delete('trees', treeId)
    await store.delete('summaries', treeId)
  },

  /** Проверка, не изменилось ли древо в другой вкладке. */
  async version(treeId) {
    const s = await store.get('summaries', treeId)
    return s?.updatedAt ?? null
  },
}
