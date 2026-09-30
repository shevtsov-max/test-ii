/**
 * Изменения древа для синхронизации с сервером.
 * Каждое действие в сторе даёт immer-патчи; из них собирается набор изменённых сущностей:
 * { tree: {name…}, upsertPersons: [...], deletePersons: [...], … } — это вход мутации applyTreeChanges.
 * Несохранённые наборы копятся в очереди (outbox) и объединяются.
 */

export const COLLECTIONS = ['persons', 'families', 'places', 'media', 'sources', 'clans']
const TREE_FIELDS = ['name', 'description', 'homePersonId', 'customFields']
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** Пустой набор изменений (id сущностей). */
export function emptyChanges() {
  return { tree: new Set(), upsert: Object.fromEntries(COLLECTIONS.map((c) => [c, new Set()])), remove: Object.fromEntries(COLLECTIONS.map((c) => [c, new Set()])), full: false }
}

/**
 * Добавляет к набору изменения из immer-патчей.
 * @param {ReturnType<typeof emptyChanges>} acc
 * @param {import('immer').Patch[]} patches
 */
export function collectChanges(acc, patches) {
  for (const p of patches) {
    const [head, id] = p.path
    if (COLLECTIONS.includes(head)) {
      if (p.path.length === 1) acc.full = true
      else if (p.path.length === 2 && p.op === 'remove') {
        acc.upsert[head].delete(id)
        acc.remove[head].add(id)
      } else {
        acc.remove[head].delete(id)
        acc.upsert[head].add(id)
      }
    } else if (TREE_FIELDS.includes(head)) acc.tree.add(head)
    else if (p.path.length === 0) acc.full = true
  }
  return acc
}

export const hasChanges = (acc) =>
  acc.full || acc.tree.size > 0 || COLLECTIONS.some((c) => acc.upsert[c].size > 0 || acc.remove[c].size > 0)

/**
 * Вход мутации applyTreeChanges по текущему состоянию древа.
 * @param {ReturnType<typeof emptyChanges>} acc
 * @param {import('@/domain/types').TreeData} tree
 */
export function changesToInput(acc, tree, baseVersion) {
  const input = { baseVersion }
  if (acc.full) {
    input.replace = { ...tree, media: Object.fromEntries(Object.entries(tree.media).map(([k, m]) => [k, { ...m, fileKey: null }])) }
    return input
  }
  if (acc.tree.size) input.tree = Object.fromEntries([...acc.tree].map((k) => [k, tree[k]]))
  for (const c of COLLECTIONS) {
    const up = [...acc.upsert[c]].map((id) => tree[c][id]).filter(Boolean)
    if (up.length) input[`upsert${cap(c)}`] = c === 'media' ? up.map((m) => ({ ...m, fileKey: null })) : up
    if (acc.remove[c].size) input[`delete${cap(c)}`] = [...acc.remove[c]]
  }
  return input
}
