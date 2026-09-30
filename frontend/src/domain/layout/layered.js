/**
 * Послойная раскладка «Все родственники»: показывает всех связанных людей (кровных, супругов,
 * родню супругов) в пределах заданного числа поколений от центра.
 *
 * Алгоритм (вариант Сугиямы для родословных):
 *  1. Поколение каждого человека — обходом в ширину от центра (родитель −1, ребёнок +1, партнёр 0).
 *  2. В каждой строке партнёры объединяются в неразрывные блоки (пары, цепочки браков).
 *  3. Порядок блоков — несколько проходов барицентрическим методом вниз и вверх
 *     с подсчётом пересечений линий; остаётся лучший порядок.
 *  4. Координаты: блоки стремятся встать под/над своими семьями; задача «ближе к желаемому при
 *     сохранении порядка и минимальных отступов» решается изотонической регрессией (PAVA).
 */
import { finishNodes, renderLinks } from './links'
import { emptyLayout } from './hourglass'

function push(map, k, v) {
  const a = map.get(k)
  if (a) a.push(v)
  else map.set(k, [v])
}

/** Изотоническая регрессия: y по неубыванию, минимум Σ w (y − t)². */
function pava(t, w) {
  const stack = []
  for (let i = 0; i < t.length; i++) {
    let cur = { v: t[i], w: w[i], n: 1 }
    while (stack.length && stack[stack.length - 1].v > cur.v) {
      const prev = stack.pop()
      const ww = prev.w + cur.w
      cur = { v: (prev.v * prev.w + cur.v * cur.w) / ww, w: ww, n: prev.n + cur.n }
    }
    stack.push(cur)
  }
  const y = []
  for (const s of stack) for (let k = 0; k < s.n; k++) y.push(s.v)
  return y
}

/** Число инверсий (пересечений) в массиве пар [верх, низ]. */
function crossings(pairs) {
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const arr = pairs.map((p) => p[1])
  let count = 0
  const sort = (a) => {
    if (a.length < 2) return a
    const mid = a.length >> 1
    const l = sort(a.slice(0, mid))
    const r = sort(a.slice(mid))
    const out = []
    let i = 0
    let j = 0
    while (i < l.length && j < r.length) {
      if (l[i] <= r[j]) out.push(l[i++])
      else {
        count += l.length - i
        out.push(r[j++])
      }
    }
    while (i < l.length) out.push(l[i++])
    while (j < r.length) out.push(r[j++])
    return out
  }
  sort(arr)
  return count
}

/**
 * @param {import('../graph').FamilyGraph} G
 * @param {string} focusId
 * @param {{ up: number, down: number, maxPersons?: number }} opts
 * @param {ReturnType<import('./metrics').chartMetrics>} M
 */
export function computeLayered(G, focusId, opts, M) {
  const { W, H, COUPLE_GAP, SIB_GAP, GROUP_GAP } = M
  if (!G.person(focusId)) return emptyLayout(M)
  const maxPersons = opts.maxPersons ?? 900

  // ---------------------------------------------------------------- 1. поколения
  const gen = new Map([[focusId, 0]])
  const disc = new Map([[focusId, 0]])
  const queue = [focusId]
  let truncated = false
  while (queue.length) {
    const cur = queue.shift()
    const g0 = gen.get(cur)
    for (const n of G.neighbours(cur)) {
      if (gen.has(n.id)) continue
      const g1 = n.type === 'parent' ? g0 - 1 : n.type === 'child' ? g0 + 1 : g0
      if (g1 < -opts.up || g1 > opts.down) continue
      if (gen.size >= maxPersons) {
        truncated = true
        continue
      }
      gen.set(n.id, g1)
      disc.set(n.id, disc.size)
      queue.push(n.id)
    }
  }

  // ---------------------------------------------------------------- 2. блоки пар
  const rowIds = new Map()
  for (const [id, g] of gen) push(rowIds, g, id)
  const rows = [...rowIds.keys()].sort((a, b) => a - b)
  const partnerAdj = new Map()
  for (const id of gen.keys()) {
    for (const f of G.spouseFamilies(id)) {
      const o = G.partnerIn(f, id)
      if (o && gen.has(o) && gen.get(o) === gen.get(id)) push(partnerAdj, id, o)
    }
  }
  const blockOf = new Map()
  const blocksByRow = new Map()
  for (const r of rows) {
    const ids = rowIds.get(r).sort((a, b) => disc.get(a) - disc.get(b))
    const seen = new Set()
    const blocks = []
    for (const id of ids) {
      if (seen.has(id)) continue
      const comp = [id]
      seen.add(id)
      for (let i = 0; i < comp.length; i++) {
        for (const o of partnerAdj.get(comp[i]) ?? []) {
          if (!seen.has(o)) {
            seen.add(o)
            comp.push(o)
          }
        }
      }
      const block = { row: r, members: orderBlock(G, comp, partnerAdj), x: 0, key: disc.get(id) }
      block.width = block.members.length * W + (block.members.length - 1) * COUPLE_GAP
      block.members.forEach((m, i) => blockOf.set(m, { block, index: i }))
      blocks.push(block)
    }
    blocksByRow.set(r, blocks)
  }
  const offsetOf = (id) => blockOf.get(id).index * (W + COUPLE_GAP)
  const centerX = (id) => blockOf.get(id).block.x + offsetOf(id) + W / 2

  // ---------------------------------------------------------------- семьи на схеме
  const famLinks = []
  const famsByChild = new Map()
  const famsByParent = new Map()
  for (const f of Object.values(G.tree.families)) {
    const parents = f.partners.filter((p) => gen.has(p))
    const kids = f.children.filter((c) => gen.has(c))
    if (!parents.length || !kids.length) continue
    const fl = { f, parents, kids }
    famLinks.push(fl)
    for (const k of kids) push(famsByChild, k, fl)
    for (const p of parents) push(famsByParent, p, fl)
  }

  // ---------------------------------------------------------------- 3. порядок
  const reindex = (r) => {
    const list = blocksByRow.get(r)
    list.forEach((b, i) => (b.idx = i))
  }
  const npos2 = (id) => {
    const { block, index } = blockOf.get(id)
    const n = blocksByRow.get(block.row).length
    return (block.idx + (index + 0.5) / block.members.length) / n
  }
  for (const r of rows) reindex(r)

  const sweep = (r, dir) => {
    const list = blocksByRow.get(r)
    for (const b of list) {
      const vals = []
      for (const m of b.members) {
        const fls = dir === 'down' ? famsByChild.get(m) : famsByParent.get(m)
        for (const fl of fls ?? []) {
          const others = dir === 'down' ? fl.parents : fl.kids
          const near = others.filter((o) => gen.get(o) === r + (dir === 'down' ? -1 : 1))
          if (near.length) vals.push(near.reduce((s, o) => s + npos2(o), 0) / near.length)
        }
      }
      b.bary = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : (b.idx + 0.5) / list.length
    }
    list.sort((a, b) => a.bary - b.bary || a.key - b.key)
    reindex(r)
  }
  const totalCrossings = () => {
    let c = 0
    for (let i = 0; i < rows.length - 1; i++) {
      const pairs = []
      for (const fl of famLinks) {
        const up = fl.parents.filter((p) => gen.get(p) === rows[i])
        if (!up.length) continue
        const a = up.reduce((s, p) => s + npos2(p), 0) / up.length
        for (const k of fl.kids) if (gen.get(k) === rows[i + 1]) pairs.push([a, npos2(k)])
      }
      c += crossings(pairs)
    }
    return c
  }
  const snapshotOrder = () => new Map(rows.map((r) => [r, [...blocksByRow.get(r)]]))
  // Начальный порядок: сверху вниз по барицентрам родителей
  for (const r of rows.slice(1)) sweep(r, 'down')
  let best = snapshotOrder()
  let bestC = totalCrossings()
  for (let it = 0; it < 12 && bestC > 0; it++) {
    for (const r of rows.slice(1)) sweep(r, 'down')
    for (const r of [...rows].reverse().slice(1)) sweep(r, 'up')
    const c = totalCrossings()
    if (c < bestC) {
      bestC = c
      best = snapshotOrder()
    }
  }
  for (const r of rows) {
    blocksByRow.set(r, best.get(r))
    reindex(r)
  }

  // ---------------------------------------------------------------- 4. координаты
  const siblingsBlocks = (a, b) => {
    for (const m of a.members) for (const fl of famsByChild.get(m) ?? []) if (b.members.some((x) => fl.kids.includes(x))) return true
    return false
  }
  for (const r of rows) {
    const list = blocksByRow.get(r)
    let x = 0
    list.forEach((b, i) => {
      if (i) x += siblingsBlocks(list[i - 1], b) ? SIB_GAP : GROUP_GAP
      b.x = x
      x += b.width
      b.gapBefore = i ? (siblingsBlocks(list[i - 1], b) ? SIB_GAP : GROUP_GAP) : 0
    })
  }

  const solveRow = (r, desire) => {
    const list = blocksByRow.get(r)
    const t = []
    const w = []
    let S = 0
    const Ss = []
    list.forEach((b, i) => {
      if (i) S += list[i - 1].width + b.gapBefore
      Ss.push(S)
      const d = desire.get(b)
      const cur = b.x
      const tw = d ? d.w : 0
      const v = d ? (d.sum + cur * 0.05) / (d.w + 0.05) : cur
      t.push(v - S)
      w.push(tw + 0.05)
    })
    const y = pava(t, w)
    list.forEach((b, i) => (b.x = y[i] + Ss[i]))
  }

  const downPass = () => {
    for (const r of rows.slice(1)) {
      const desire = new Map()
      for (const fl of famLinks) {
        const parents = fl.parents.filter((p) => gen.get(p) === r - 1)
        const kids = fl.kids.filter((k) => gen.get(k) === r)
        if (!parents.length || !kids.length) continue
        const anchor = parents.reduce((s, p) => s + centerX(p), 0) / parents.length
        kids.sort((a, b) => centerX(a) - centerX(b))
        kids.forEach((k, j) => {
          const want = anchor + (j - (kids.length - 1) / 2) * (W + SIB_GAP)
          const b = blockOf.get(k).block
          const d = desire.get(b) ?? { sum: 0, w: 0 }
          d.sum += want - offsetOf(k) - W / 2
          d.w += 1
          desire.set(b, d)
        })
      }
      solveRow(r, desire)
    }
  }
  const upPass = () => {
    for (const r of [...rows].reverse().slice(1)) {
      const desire = new Map()
      for (const fl of famLinks) {
        const parents = fl.parents.filter((p) => gen.get(p) === r)
        const kids = fl.kids.filter((k) => gen.get(k) === r + 1)
        if (!parents.length || !kids.length) continue
        const xs = kids.map(centerX)
        const c = (Math.min(...xs) + Math.max(...xs)) / 2
        const b = blockOf.get(parents[0]).block
        const sameBlock = parents.every((p) => blockOf.get(p).block === b)
        const anchorOff = sameBlock ? parents.reduce((s, p) => s + offsetOf(p) + W / 2, 0) / parents.length : offsetOf(parents[0]) + W / 2
        const d = desire.get(b) ?? { sum: 0, w: 0 }
        const weight = Math.sqrt(kids.length)
        d.sum += (c - anchorOff) * weight
        d.w += weight
        desire.set(b, d)
      }
      solveRow(r, desire)
    }
  }
  for (let i = 0; i < 10; i++) {
    downPass()
    upPass()
  }
  downPass()

  // ---------------------------------------------------------------- 5. узлы и линии
  const nodes = []
  const nodeOf = new Map()
  for (const r of rows) {
    for (const b of blocksByRow.get(r)) {
      for (const m of b.members) {
        const n = { key: m, kind: 'person', personId: m, x: centerX(m), row: r, w: W, h: H, dup: false, focus: m === focusId }
        nodes.push(n)
        nodeOf.set(m, n)
      }
    }
  }
  const fx = nodeOf.get(focusId).x
  for (const n of nodes) n.x -= fx

  const links = []
  const coupleDone = new Set()
  for (const id of gen.keys()) {
    for (const f of G.spouseFamilies(id)) {
      const o = G.partnerIn(f, id)
      if (!o || !gen.has(o) || coupleDone.has(f.id)) continue
      coupleDone.add(f.id)
      links.push({ type: 'couple', key: `c-${f.id}`, familyId: f.id, status: f.status, a: nodeOf.get(id), b: nodeOf.get(o) })
    }
  }
  for (const fl of famLinks) {
    const pr = fl.parents.map((p) => nodeOf.get(p))
    const parents = pr.length === 2 && pr[0].row !== pr[1].row ? [pr[0]] : pr
    links.push({
      type: 'children',
      key: `k-${fl.f.id}`,
      familyId: fl.f.id,
      parents,
      children: fl.kids.map((k) => nodeOf.get(k)).sort((a, b) => a.x - b.x),
      childLinks: fl.f.childLinks,
    })
  }

  const { shown, bounds } = finishNodes(G, nodes, M)
  return { nodes, edges: renderLinks(links, nodes, M), bounds, focusNode: nodeOf.get(focusId), shown, metrics: M, truncated }
}

/** Порядок людей в блоке партнёров: цепочка браков — по цепочке, пара — мужчина слева. */
function orderBlock(G, comp, adj) {
  if (comp.length === 1) return comp
  if (comp.length === 2) {
    const [a, b] = comp
    return G.person(a)?.gender === 'F' && G.person(b)?.gender !== 'F' ? [b, a] : [a, b]
  }
  const deg = (id) => (adj.get(id) ?? []).filter((x) => comp.includes(x)).length
  const maxDeg = Math.max(...comp.map(deg))
  if (maxDeg <= 2) {
    // Цепочка: A — B — C
    const start = comp.find((id) => deg(id) === 1) ?? comp[0]
    const out = [start]
    const seen = new Set(out)
    while (out.length < comp.length) {
      const next = (adj.get(out[out.length - 1]) ?? []).find((x) => comp.includes(x) && !seen.has(x))
      if (!next) break
      out.push(next)
      seen.add(next)
    }
    for (const id of comp) if (!seen.has(id)) out.push(id)
    return out
  }
  // Звезда: человек с несколькими браками в центре, партнёры по обе стороны
  const center = comp.reduce((a, b) => (deg(b) > deg(a) ? b : a))
  const partners = G.spouseFamilies(center)
    .map((f) => G.partnerIn(f, center))
    .filter((x) => x && comp.includes(x))
  const left = []
  const right = []
  partners.forEach((p, i) => (i % 2 === 0 ? left.unshift(p) : right.push(p)))
  const out = [...left, center, ...right]
  for (const id of comp) if (!out.includes(id)) out.push(id)
  return out
}
