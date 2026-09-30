/**
 * FamilyGraph — индекс связей древа: родители, дети, партнёры, братья и сёстры, предки, путь между людьми.
 * Строится один раз на версию древа (древо неизменяемо), все выборки кешируются.
 */
import { sortKey } from './dates'
import { childLink } from './model'

const BLOOD_LINKS = new Set(['birth', 'unknown'])

function push(map, key, value) {
  const arr = map.get(key)
  if (arr) arr.push(value)
  else map.set(key, [value])
}

export class FamilyGraph {
  /** @param {import('./types').TreeData} tree */
  constructor(tree) {
    this.tree = tree
    /** @type {Map<string, import('./types').Family[]>} */
    this._parentFams = new Map()
    /** @type {Map<string, import('./types').Family[]>} */
    this._spouseFams = new Map()
    /** @type {Map<string, import('./types').Media[]>} */
    this._media = new Map()
    this._cache = new Map()

    for (const f of Object.values(tree.families)) {
      for (const c of f.children) if (tree.persons[c]) push(this._parentFams, c, f)
      for (const p of f.partners) if (tree.persons[p]) push(this._spouseFams, p, f)
    }
    const rank = (f, c) => {
      const l = childLink(f, c)
      return l === 'birth' ? 0 : l === 'unknown' ? 1 : 2
    }
    for (const [c, fams] of this._parentFams) if (fams.length > 1) fams.sort((a, b) => rank(a, c) - rank(b, c))
    for (const fams of this._spouseFams.values())
      if (fams.length > 1) fams.sort((a, b) => sortKey(a.marriage.date) - sortKey(b.marriage.date))
    for (const m of Object.values(tree.media ?? {})) for (const pid of m.personIds ?? []) push(this._media, pid, m)
  }

  memo(key, fn) {
    if (this._cache.has(key)) return this._cache.get(key)
    const v = fn()
    this._cache.set(key, v)
    return v
  }

  person(id) {
    return id ? this.tree.persons[id] : undefined
  }
  get persons() {
    return this.tree.persons
  }
  family(id) {
    return id ? this.tree.families[id] : undefined
  }

  /** Все семьи-родители (основная — первая). */
  parentFamilies(id) {
    return this._parentFams.get(id) ?? []
  }
  /** Основная семья-родители (кровные, если известны). */
  parentFamily(id) {
    return this._parentFams.get(id)?.[0]
  }
  /** Семьи, где персона — партнёр (по дате брака). */
  spouseFamilies(id) {
    return this._spouseFams.get(id) ?? []
  }
  partnerIn(f, pid) {
    return f.partners.find((x) => x !== pid)
  }

  /** [отец, мать] семьи: по полу, при одинаковом или неизвестном — по порядку. */
  orderPartners(f) {
    const [a, b] = f.partners
    if (!b) {
      const p = this.person(a)
      if (!p) return [undefined, undefined]
      return p.gender === 'F' ? [undefined, a] : [a, undefined]
    }
    const pa = this.person(a)
    const pb = this.person(b)
    if (pa?.gender === 'F' && pb?.gender !== 'F') return [b, a]
    return [a, b]
  }

  parents(id, family = this.parentFamily(id)) {
    if (!family) return { family: undefined, father: undefined, mother: undefined }
    const [father, mother] = this.orderPartners(family)
    return { family, father, mother }
  }

  byBirth = (a, b) => sortKey(this.person(a)?.birth.date) - sortKey(this.person(b)?.birth.date)

  /** Дети семьи по дате рождения. */
  familyChildren(f) {
    return this.memo('fc:' + f.id, () => f.children.filter((c) => this.person(c)).sort(this.byBirth))
  }

  children(id) {
    return this.memo('ch:' + id, () => {
      const out = []
      for (const f of this.spouseFamilies(id)) for (const c of f.children) if (!out.includes(c) && this.person(c)) out.push(c)
      return out.sort(this.byBirth)
    })
  }

  partners(id) {
    return this.spouseFamilies(id)
      .map((f) => ({ id: this.partnerIn(f, id), family: f }))
      .filter((x) => !!x.id && this.person(x.id))
  }

  /** Братья и сёстры: полнородные (та же семья) и единокровные/единоутробные (через другие семьи родителей). */
  siblings(id) {
    return this.memo('sib:' + id, () => {
      const pf = this.parentFamily(id)
      const full = pf ? pf.children.filter((c) => c !== id && this.person(c)) : []
      const half = []
      if (pf) {
        for (const par of pf.partners) {
          for (const f of this.spouseFamilies(par)) {
            if (f.id === pf.id) continue
            for (const c of f.children) if (c !== id && this.person(c) && !full.includes(c) && !half.includes(c)) half.push(c)
          }
        }
      }
      return { full: full.sort(this.byBirth), half: half.sort(this.byBirth) }
    })
  }

  /**
   * Предки с расстоянием в поколениях (сама персона — 0).
   * @param {'blood' | 'all'} links blood — только кровные связи, all — включая приёмных родителей
   * @returns {Map<string, number>}
   */
  ancestorDistances(id, links = 'blood') {
    return this.memo(`anc:${links}:${id}`, () => {
      const dist = new Map([[id, 0]])
      const q = [id]
      while (q.length) {
        const cur = q.shift()
        for (const f of this.parentFamilies(cur)) {
          if (links === 'blood' && !BLOOD_LINKS.has(childLink(f, cur))) continue
          for (const p of f.partners) {
            if (!dist.has(p) && this.person(p)) {
              dist.set(p, dist.get(cur) + 1)
              q.push(p)
            }
          }
          if (links === 'blood') break
        }
      }
      return dist
    })
  }

  /** Потомки с расстоянием (сама персона — 0). */
  descendantDistances(id) {
    return this.memo('desc:' + id, () => {
      const dist = new Map([[id, 0]])
      const q = [id]
      while (q.length) {
        const cur = q.shift()
        for (const c of this.children(cur)) {
          if (!dist.has(c)) {
            dist.set(c, dist.get(cur) + 1)
            q.push(c)
          }
        }
      }
      return dist
    })
  }

  isAncestor(ancestorId, id) {
    return ancestorId !== id && this.ancestorDistances(id, 'all').has(ancestorId)
  }

  /** Прямая линия: предки и потомки персоны. */
  lineage(id) {
    return this.memo('lin:' + id, () => new Set([...this.ancestorDistances(id, 'all').keys(), ...this.descendantDistances(id).keys()]))
  }

  /** Все, кто связан с персоной (компонента связности). */
  component(id) {
    return this.memo('comp:' + id, () => {
      const seen = new Set([id])
      const q = [id]
      while (q.length) {
        const cur = q.shift()
        const fams = [...this.parentFamilies(cur), ...this.spouseFamilies(cur)]
        for (const f of fams) {
          for (const x of [...f.partners, ...f.children]) {
            if (!seen.has(x) && this.person(x)) {
              seen.add(x)
              q.push(x)
            }
          }
        }
      }
      return seen
    })
  }

  /** Соседи в графе родства: родители, дети, партнёры. */
  neighbours(id) {
    const out = []
    for (const f of this.parentFamilies(id)) for (const p of f.partners) if (this.person(p)) out.push({ id: p, type: 'parent', family: f })
    for (const f of this.spouseFamilies(id)) {
      const other = this.partnerIn(f, id)
      if (other && this.person(other)) out.push({ id: other, type: 'partner', family: f })
      for (const c of f.children) if (this.person(c)) out.push({ id: c, type: 'child', family: f })
    }
    return out
  }

  /**
   * Кратчайшая цепочка родства от a до b (шаги «родитель», «ребёнок», «партнёр»).
   * Кровные связи предпочтительнее: шаг через партнёра стоит дороже.
   * @returns {{ from: string, to: string, type: 'parent' | 'child' | 'partner' }[] | null}
   */
  path(a, b) {
    if (!this.person(a) || !this.person(b)) return null
    if (a === b) return []
    // Дейкстра с весами: родитель/ребёнок = 1, партнёр = 1.5
    const dist = new Map([[a, 0]])
    const prev = new Map()
    const open = [[0, a]]
    while (open.length) {
      open.sort((x, y) => x[0] - y[0])
      const [d, cur] = open.shift()
      if (cur === b) break
      if (d > (dist.get(cur) ?? Infinity)) continue
      for (const n of this.neighbours(cur)) {
        const nd = d + (n.type === 'partner' ? 1.5 : 1)
        if (nd < (dist.get(n.id) ?? Infinity)) {
          dist.set(n.id, nd)
          prev.set(n.id, { from: cur, type: n.type })
          open.push([nd, n.id])
        }
      }
    }
    if (!prev.has(b)) return null
    const steps = []
    let cur = b
    while (cur !== a) {
      const p = prev.get(cur)
      steps.unshift({ from: p.from, to: cur, type: p.type })
      cur = p.from
    }
    return steps
  }

  mediaOf(id) {
    return this._media.get(id) ?? []
  }

  /** Главное фото персоны (медиа) или null. */
  avatarOf(p) {
    return (p?.avatarId && this.tree.media?.[p.avatarId]) || null
  }
}
