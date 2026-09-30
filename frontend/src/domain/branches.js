/**
 * Переданные ветки в древе владельца.
 *
 * Ветка — персона, её потомки и их супруги (как на сервере, backend/app/Domain/Branch.php). После того как родственник
 * принял ветку, владелец видит её из древа родственника — со всеми его изменениями — и не может её править.
 * Сервер отдаёт живые ветки запросом delegatedBranches; здесь они накладываются на данные древа.
 */

const MERGE_ADD = ['places', 'sources', 'clans']
const COLLECTIONS = ['persons', 'families', 'media', ...MERGE_ADD]

/**
 * Персоны ветки: корень, все потомки и их супруги/партнёры.
 * @param {import('./types').TreeData} tree
 * @param {string} rootId
 * @returns {string[]}
 */
export function branchPersonIds(tree, rootId) {
  if (!tree.persons[rootId]) return []
  const inBranch = new Set([rootId])
  const queue = [rootId]
  const families = Object.values(tree.families)
  while (queue.length) {
    const id = queue.shift()
    for (const f of families) {
      if (!f.partners.includes(id)) continue
      for (const p of f.partners) if (tree.persons[p]) inBranch.add(p)
      for (const c of f.children) {
        if (tree.persons[c] && !inBranch.has(c)) {
          inBranch.add(c)
          queue.push(c)
        }
      }
    }
  }
  return [...inBranch]
}

/**
 * Наложить живые ветки на древо.
 * @param {import('./types').TreeData} tree
 * @param {{ delegation: { id: string, personIds: string[] }, data: Partial<import('./types').TreeData> }[]} branches
 * @param {{ personIds: string[] }[]} active все принятые передачи (у некоторых живых данных может не быть)
 * @returns {{ tree: import('./types').TreeData, locked: { persons: Set<string>, families: Set<string>, media: Set<string> }, owner: Record<string, string> }}
 *   owner — id персоны → id передачи, которой она принадлежит
 */
export function applyBranches(tree, branches, active = branches.map((b) => b.delegation)) {
  const locked = { persons: new Set(), families: new Set(), media: new Set() }
  const owner = {}
  for (const d of active) for (const id of d.personIds ?? []) locked.persons.add(id)
  if (!locked.persons.size) return { tree, locked, owner }

  const next = { ...tree }
  for (const c of ['persons', 'families', 'media', ...MERGE_ADD]) next[c] = { ...(tree[c] ?? {}) }

  for (const { delegation: d, data } of branches) {
    if (!data?.persons) continue
    const ids = new Set(d.personIds)
    // Прежние данные ветки уступают место актуальным из древа родственника
    for (const [fid, f] of Object.entries(next.families)) {
      if (f.partners.length && f.partners.every((p) => ids.has(p))) delete next.families[fid]
    }
    for (const id of ids) delete next.persons[id]
    for (const [id, p] of Object.entries(data.persons)) {
      next.persons[id] = p
      locked.persons.add(id)
    }
    for (const [id, f] of Object.entries(data.families ?? {})) {
      next.families[id] = f
      locked.families.add(id)
    }
    for (const [id, m] of Object.entries(data.media ?? {})) {
      next.media[id] = m
      locked.media.add(id)
    }
    for (const c of MERGE_ADD) for (const [id, v] of Object.entries(data[c] ?? {})) next[c][id] ??= v
  }
  for (const d of active) for (const id of d.personIds ?? []) owner[id] = d.id
  for (const { delegation: d, data } of branches) for (const id of Object.keys(data?.persons ?? {})) owner[id] = d.id

  // Семьи, где хотя бы один из супругов — из переданной ветки, тоже её часть
  for (const [fid, f] of Object.entries(next.families)) {
    if (f.partners.some((p) => locked.persons.has(p))) locked.families.add(fid)
  }
  return { tree: next, locked, owner }
}

/**
 * Затрагивают ли immer-патчи закрытые данные.
 * @param {import('immer').Patch[]} patches
 * @param {{ persons: Set<string>, families: Set<string>, media: Set<string> }} locked
 * @param {import('./types').TreeData} before
 * @param {import('./types').TreeData} after
 */
export function touchesLocked(patches, locked, before, after) {
  if (!locked.persons.size) return false
  const lockedPartner = (f) => !!f && f.partners.some((p) => locked.persons.has(p))
  for (const p of patches) {
    const [head, id] = p.path
    // Замена древа целиком (импорт поверх) невозможна, пока ветки переданы
    if (p.path.length <= 1 && (head === undefined || COLLECTIONS.includes(head))) return true
    if (head === 'persons' && locked.persons.has(id)) return true
    if (head === 'media' && locked.media.has(id)) return true
    if (head === 'families' && (locked.families.has(id) || lockedPartner(before.families[id]) || lockedPartner(after.families[id]))) return true
  }
  return false
}
