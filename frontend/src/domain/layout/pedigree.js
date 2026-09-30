/**
 * Родословная (горизонтальная схема предков): центральная персона слева, предки — столбцами вправо.
 * Компактная раскладка: место резервируется только под существующие ветви; родители
 * центрируются относительно своих детей. Дети центральной персоны — столбцом слева.
 */

/**
 * @param {import('../graph').FamilyGraph} G
 * @param {string} focusId
 * @param {{ generations: number, placeholders: boolean, children?: boolean }} opts
 * @param {ReturnType<import('./metrics').chartMetrics>} M
 */
export function computePedigree(G, focusId, opts, M) {
  const { W, H, R } = M
  const GX = Math.round(W * 0.3)
  const SLOT = H + 16
  const PW = Math.round(W * 0.62)
  const PH = Math.round(H * 0.62)
  const nodes = []
  const edges = []
  const seen = new Map()
  let leaf = 0
  const colX = (gen) => gen * (W + GX)

  const elbow = (x1, y1, x2, y2) => {
    const mx = x1 + GX / 2
    if (Math.abs(y2 - y1) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`
    const s = Math.sign(y2 - y1)
    const r = Math.min(R, Math.abs(y2 - y1) / 2)
    return `M ${x1} ${y1} L ${mx - r} ${y1} Q ${mx} ${y1} ${mx} ${y1 + s * r} L ${mx} ${y2 - s * r} Q ${mx} ${y2} ${mx + r} ${y2} L ${x2} ${y2}`
  }

  function place(pid, gen, forId, role) {
    if (!pid) {
      const n = { key: `ph-${role}-${forId}`, kind: 'placeholder', role, forId, gen, x: colX(gen) + PW / 2, y: leaf++ * SLOT + H / 2, w: PW, h: PH }
      nodes.push(n)
      return n
    }
    const dupOf = seen.get(pid)
    const n = { key: dupOf ? `${pid}#${gen}-${leaf}` : pid, kind: 'person', personId: pid, gen, x: colX(gen) + W / 2, y: 0, w: W, h: H, dup: !!dupOf, focus: gen === 0 }
    seen.set(pid, n)
    nodes.push(n)
    const parents = []
    if (!dupOf && gen < opts.generations) {
      const { father, mother, family } = G.parents(pid)
      const full = (family?.partners.length ?? 0) >= 2
      for (const [par, r] of [
        [father, 'father'],
        [mother, 'mother'],
      ]) {
        if (par) parents.push(place(par, gen + 1))
        else if (opts.placeholders && !full && gen < 3) parents.push(place(null, gen + 1, pid, r))
      }
    }
    if (parents.length) n.y = (parents[0].y + parents[parents.length - 1].y) / 2
    else n.y = leaf++ * SLOT + H / 2
    for (const p of parents) {
      edges.push({
        key: `pe-${n.key}-${p.key}`,
        kind: 'child',
        d: elbow(n.x + W / 2, n.y, p.x - p.w / 2, p.y),
        dashed: p.kind === 'placeholder',
        persons: [pid, p.personId].filter(Boolean),
        familyId: null,
      })
    }
    return n
  }

  if (!G.person(focusId)) return { nodes, edges, bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, focusNode: null, columns: [], shown: new Set() }
  const focus = place(focusId, 0)

  // Дети — слева от центральной персоны
  if (opts.children !== false) {
    const kids = G.children(focusId)
    const total = kids.length * SLOT - 16
    kids.forEach((c, i) => {
      const n = { key: `kid-${c}`, kind: 'person', personId: c, gen: -1, x: -GX - W / 2, y: focus.y - total / 2 + i * SLOT + H / 2, w: W, h: H }
      nodes.push(n)
      const x1 = focus.x - W / 2
      const x2 = n.x + W / 2
      const mx = x1 - GX / 2
      const s = Math.sign(n.y - focus.y)
      const r = Math.min(R, Math.abs(n.y - focus.y) / 2)
      const d =
        Math.abs(n.y - focus.y) < 1
          ? `M ${x1} ${focus.y} L ${x2} ${n.y}`
          : `M ${x1} ${focus.y} L ${mx + r} ${focus.y} Q ${mx} ${focus.y} ${mx} ${focus.y + s * r} L ${mx} ${n.y - s * r} Q ${mx} ${n.y} ${mx - r} ${n.y} L ${x2} ${n.y}`
      edges.push({ key: `ke-${c}`, kind: 'child', d, dashed: false, persons: [focusId, c], familyId: null })
    })
  }

  // Центр — в начале координат
  const dy = -focus.y
  const dx = -focus.x
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    n.x += dx
    n.y += dy
    n.left = n.x - n.w / 2
    n.top = n.y - n.h / 2
    minX = Math.min(minX, n.left)
    maxX = Math.max(maxX, n.left + n.w)
    minY = Math.min(minY, n.top)
    maxY = Math.max(maxY, n.top + n.h)
  }
  for (const e of edges) e.d = shiftPath(e.d, dx, dy)
  const gens = [...new Set(nodes.map((n) => n.gen))].sort((a, b) => a - b)
  const columns = gens.map((g) => ({ gen: g, x: (g >= 0 ? colX(g) + W / 2 : -GX - W / 2) + dx }))
  const shown = new Set(nodes.filter((n) => n.personId).map((n) => n.personId))
  for (const n of nodes) {
    if (!n.personId) continue
    const pf = G.parentFamily(n.personId)
    n.moreUp = n.gen >= 0 && !!pf && pf.partners.length > 0 && !pf.partners.some((p) => shown.has(p))
    n.moreDown = false
  }
  return { nodes, edges, bounds: { minX, minY: minY - 30, maxX, maxY }, focusNode: focus, columns, shown, metrics: M }
}

/** Сдвиг всех координат в пути из команд M/L/Q/C. */
function shiftPath(d, dx, dy) {
  let i = 0
  return d.replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g, (num) => {
    const v = parseFloat(num) + (i++ % 2 === 0 ? dx : dy)
    return String(Math.round(v * 100) / 100)
  })
}
