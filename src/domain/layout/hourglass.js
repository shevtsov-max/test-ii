/**
 * Раскладка «песочные часы» вокруг центральной персоны.
 *
 * Вниз — потомки (с партнёрами). Вверх — предки. В зависимости от охвата (scope):
 *  • direct — только прямые предки и потомки;
 *  • family — плюс братья/сёстры центра (с потомками) и братья/сёстры предков, их другие партнёры
 *    и сводные братья/сёстры (без потомков);
 *  • blood — все кровные родственники: у братьев и сестёр предков показаны все потомки
 *    (двоюродные, троюродные…), глубина ограничена числом поколений вниз.
 * Упаковка поддеревьев — контурная, поэтому схема компактна и без пересечений.
 */
import { Shape, centerOf, constGap, leftLimit, overlapShift, packRow, rightOffset } from './contour'
import { finishNodes, renderLinks } from './links'

/**
 * @param {import('../graph').FamilyGraph} G
 * @param {string} focusId
 * @param {{ up: number, down: number, scope: 'family' | 'direct' | 'blood', placeholders: boolean, partners?: boolean }} opts
 * @param {ReturnType<import('./metrics').chartMetrics>} M
 */
export function computeHourglass(G, focusId, opts, M) {
  const { W, H, COUPLE_GAP, SIB_GAP, GROUP_GAP, PH_W, PH_H, PH_PAIR_GAP } = M
  const scope = opts.scope ?? 'family'
  const withSiblings = scope !== 'direct'
  const bloodMode = scope === 'blood'
  const showPartners = opts.partners !== false
  const expanded = new Set()
  const keyCount = new Map()
  const sortBirth = G.byBirth

  function personNode(pid, row) {
    const n = (keyCount.get(pid) ?? 0) + 1
    keyCount.set(pid, n)
    return { key: n === 1 ? pid : `${pid}#${n}`, kind: 'person', personId: pid, x: 0, row, w: W, h: H, dup: n > 1 }
  }
  function placeholder(forId, role, row) {
    return { key: `ph-${role}-${forId}`, kind: 'placeholder', role, forId, x: 0, row, w: PH_W, h: PH_H }
  }

  /**
   * Строка «персона + партнёры».
   * sideHint: у предков по отцу другие партнёры ставятся слева, по матери — справа.
   */
  function unit(pid, row, sideHint = 'auto') {
    const s = new Shape()
    const fams = G.spouseFamilies(pid)
    const withPartner = showPartners ? fams.filter((f) => G.partnerIn(f, pid) && G.person(G.partnerIn(f, pid))) : []
    const me = personNode(pid, row)
    const gender = G.person(pid)?.gender
    let order
    const items = withPartner.map((f) => ({ fam: f }))
    if (sideHint === 'left') order = [...items.reverse(), me]
    else if (sideHint === 'right') order = [me, ...items]
    else if (items.length === 0) order = [me]
    else if (items.length === 1) order = gender === 'F' ? [items[0], me] : [me, items[0]]
    else if (items.length === 2) order = [items[0], me, items[1]]
    else order = gender === 'F' ? [...items.reverse(), me] : [me, ...items]

    const partnerNodes = new Map()
    let x = 0
    for (const item of order) {
      let node
      if ('fam' in item) {
        node = personNode(G.partnerIn(item.fam, pid), row)
        partnerNodes.set(item.fam.id, node)
        s.links.push({ type: 'couple', key: `c-${item.fam.id}`, familyId: item.fam.id, status: item.fam.status, a: node, b: me })
      } else node = item
      node.x = x
      s.add(node)
      x += W + COUPLE_GAP
    }
    return { shape: s, me, partnerNodes, fams }
  }

  /** Поддерево потомков. */
  function desc(pid, row, depth) {
    if (expanded.has(pid)) {
      const s = new Shape()
      s.add(personNode(pid, row))
      return s
    }
    expanded.add(pid)
    const u = unit(pid, row)
    const s = u.shape
    for (const pn of u.partnerNodes.values()) expanded.add(pn.personId)
    if (depth <= 0) return s

    const groups = []
    for (const f of u.fams) {
      const kids = G.familyChildren(f)
      if (!kids.length) continue
      const pn = u.partnerNodes.get(f.id)
      const shapes = kids.map((k) => desc(k, row + 1, depth - 1))
      const primary = shapes.map((sh, i) => sh.nodes.find((n) => n.personId === kids[i] && n.row === row + 1))
      const g = packRow(shapes, constGap(SIB_GAP))
      const anchor = pn ? (pn.x + u.me.x) / 2 : u.me.x
      groups.push({ shape: g, anchor, kids: primary, fam: f })
    }
    groups.sort((a, b) => a.anchor - b.anchor)
    const acc = new Shape()
    const placed = []
    for (const g of groups) {
      let dx = g.anchor - centerOf(g.kids)
      if (acc.nodes.length) {
        g.shape.shift(dx)
        const need = rightOffset(acc, g.shape, constGap(GROUP_GAP))
        g.shape.shift(-dx)
        dx += Math.max(0, need)
      }
      g.shape.shift(dx)
      acc.merge(g.shape)
      placed.push(g)
    }
    if (placed.length) {
      const dev = placed.reduce((sum, g) => sum + (centerOf(g.kids) - g.anchor), 0) / placed.length
      acc.shift(-dev)
      s.merge(acc)
      for (const g of placed) {
        const pn = u.partnerNodes.get(g.fam.id)
        s.links.push({
          type: 'children',
          key: `k-${g.fam.id}`,
          familyId: g.fam.id,
          parents: pn ? [u.me, pn] : [u.me],
          children: g.kids,
          childLinks: g.fam.childLinks,
        })
      }
    }
    return s
  }

  /** Строка без потомков: персона + партнёры (для братьев/сестёр предков). */
  function flat(pid, row) {
    expanded.add(pid)
    const u = unit(pid, row)
    for (const pn of u.partnerNodes.values()) expanded.add(pn.personId)
    return u.shape
  }

  /** Добавляет к фигуре S (содержащей персону X) её братьев/сестёр, родителей и всех предков. */
  function up(X, S, nodeX, row, levels, side, sibDesc) {
    const pf = G.parentFamily(X)
    const visible = levels > 0

    if (!pf || !visible) {
      if (!pf && visible && opts.placeholders) {
        const f = placeholder(X, 'father', row - 1)
        const m = placeholder(X, 'mother', row - 1)
        f.x = nodeX.x - (PH_W + PH_PAIR_GAP) / 2
        m.x = nodeX.x + (PH_W + PH_PAIR_GAP) / 2
        S.add(f)
        S.add(m)
        S.links.push({ type: 'couple', key: `pc-${X}`, familyId: null, status: 'unknown', a: f, b: m, dashed: true })
        S.links.push({ type: 'children', key: `pk-${X}`, familyId: null, parents: [f, m], children: [nodeX], dashed: true })
      }
      return S
    }

    const [fa, mo] = G.orderPartners(pf)
    const make = (pid) => (sibDesc ? desc(pid, row, bloodMode ? opts.down - row : opts.down) : flat(pid, row))
    const primaryOf = (sh, pid) => sh.nodes.find((n) => n.personId === pid && n.row === row)

    // --- Полнородные братья и сёстры
    const sibIds = withSiblings ? G.familyChildren(pf).filter((c) => c !== X) : []
    const sibShapes = sibIds.map((id) => ({ id, shape: make(id) }))
    const self = { id: X, shape: S }
    let ordered
    if (side === 'left') ordered = [...sibShapes, self]
    else if (side === 'right') ordered = [self, ...sibShapes]
    else ordered = [...sibShapes, self].sort((a, b) => sortBirth(a.id, b.id))
    const kidsNodes = ordered.map((o) => (o.id === X ? nodeX : primaryOf(o.shape, o.id)))
    const full = packRow(
      ordered.map((o) => o.shape),
      constGap(SIB_GAP),
    )

    // --- Родители (узлы-строки)
    const faFams = fa && withSiblings && showPartners ? G.spouseFamilies(fa).filter((f) => f.id !== pf.id) : []
    const moFams = mo && withSiblings && showPartners ? G.spouseFamilies(mo).filter((f) => f.id !== pf.id) : []
    let A1 = null
    let A2 = null
    let faNode = null
    let moNode = null
    const faOther = new Map()
    const moOther = new Map()

    const buildParentUnit = (pid, others, sideP, store) => {
      const s = new Shape()
      const me = personNode(pid, row - 1)
      expanded.add(pid)
      const partnered = others.filter((f) => G.partnerIn(f, pid) && G.person(G.partnerIn(f, pid)))
      const items = sideP === 'left' ? [...[...partnered].reverse(), me] : [me, ...partnered]
      let x = 0
      for (const it of items) {
        let n
        if ('partners' in it) {
          const other = G.partnerIn(it, pid)
          n = personNode(other, row - 1)
          expanded.add(other)
          store.set(it.id, n)
        } else n = it
        n.x = x
        s.add(n)
        x += W + COUPLE_GAP
      }
      for (const f of partnered) {
        const n = store.get(f.id)
        const [a, b] = n.x < me.x ? [n, me] : [me, n]
        s.links.push({ type: 'couple', key: `c-${f.id}`, familyId: f.id, status: f.status, a, b })
      }
      return { s, me }
    }

    /**
     * «Кровные»: сводные братья/сёстры (с потомками) подвешиваются к строке родителя ещё до
     * подъёма к предкам — тогда братья и сёстры родителя со своими потомками пакуются рядом без наложений.
     */
    const attachHalf = (unitShape, parentNode, others, store, dir) => {
      for (const f of others) {
        const kids = G.familyChildren(f).filter((c) => !expanded.has(c))
        if (!kids.length) continue
        const shapes = kids.map((k) => make(k))
        const kn = shapes.map((sh, i) => primaryOf(sh, kids[i]))
        const g = packRow(shapes, constGap(SIB_GAP))
        const otherNode = store.get(f.id)
        g.shift((otherNode ? (otherNode.x + parentNode.x) / 2 : parentNode.x) - centerOf(kn))
        if (dir === 'left') {
          const need = overlapShift(g, unitShape, GROUP_GAP)
          if (need > 0) g.shift(-need)
        } else {
          const need = overlapShift(unitShape, g, GROUP_GAP)
          if (need > 0) g.shift(need)
        }
        unitShape.merge(g)
        unitShape.links.push({
          type: 'children',
          key: `k-${f.id}`,
          familyId: f.id,
          parents: otherNode ? [otherNode, parentNode].sort((p, q) => p.x - q.x) : [parentNode],
          children: kn,
          childLinks: f.childLinks,
        })
      }
    }

    if (fa) {
      const r = buildParentUnit(fa, faFams, 'left', faOther)
      faNode = r.me
      if (bloodMode) attachHalf(r.s, r.me, faFams, faOther, 'left')
      A1 = up(fa, r.s, r.me, row - 1, levels - 1, 'left', bloodMode)
    } else if (opts.placeholders) {
      A1 = new Shape()
      faNode = A1.add(placeholder(X, 'father', row - 1))
    }
    if (mo) {
      const r = buildParentUnit(mo, moFams, 'right', moOther)
      moNode = r.me
      if (bloodMode) attachHalf(r.s, r.me, moFams, moOther, 'right')
      A2 = up(mo, r.s, r.me, row - 1, levels - 1, 'right', bloodMode)
    } else if (opts.placeholders) {
      A2 = new Shape()
      moNode = A2.add(placeholder(X, 'mother', row - 1))
    }
    if (A1 && A2) A2.shift(rightOffset(A1, A2, (r) => (r === row - 1 ? COUPLE_GAP : GROUP_GAP)))

    const anchor = faNode && moNode ? (faNode.x + moNode.x) / 2 : ((faNode ?? moNode)?.x ?? 0)
    full.shift(anchor - centerOf(kidsNodes))

    // «Кровные»: потомки братьев/сестёр родителей занимают те же строки, что и дети — раздвигаем стороны
    if (bloodMode) {
      const dl = A1 ? overlapShift(A1, full, GROUP_GAP) : -Infinity
      const dr = A2 ? overlapShift(full, A2, GROUP_GAP) : -Infinity
      const d = Math.max(0, dl, dr)
      if (d > 0) {
        if (A1 && A2) {
          A1.shift(-d)
          A2.shift(d)
        } else full.shift(A1 ? d : -d)
      }
    }

    const upper = new Shape()
    if (A1) upper.merge(A1)
    if (A2) upper.merge(A2)
    if (faNode && moNode) {
      const bothReal = faNode.kind === 'person' && moNode.kind === 'person'
      upper.links.push({
        type: 'couple',
        key: bothReal ? `c-${pf.id}` : `pc-${pf.id}`,
        familyId: pf.id,
        status: pf.status,
        a: faNode,
        b: moNode,
        dashed: !bothReal,
      })
    }

    const Gs = new Shape()
    Gs.merge(full)
    const parentsNodes = [faNode, moNode].filter(Boolean)
    Gs.links.push({
      type: 'children',
      key: `k-${pf.id}`,
      familyId: pf.id,
      parents: parentsNodes,
      children: kidsNodes,
      childLinks: pf.childLinks,
      dashed: parentsNodes.every((n) => n.kind === 'placeholder'),
    })

    // --- Сводные братья/сёстры (дети родителей от других союзов)
    const halfGroup = (f, parentNode, otherNode, dir) => {
      const kids = G.familyChildren(f).filter((c) => !expanded.has(c))
      if (!kids.length) return
      const shapes = kids.map((k) => make(k))
      const kn = shapes.map((sh, i) => primaryOf(sh, kids[i]))
      const g = packRow(shapes, constGap(SIB_GAP))
      const a = otherNode ? (otherNode.x + parentNode.x) / 2 : parentNode.x
      let dx = a - centerOf(kn)
      if (dir === 'left') dx = Math.min(dx, leftLimit(Gs, g, constGap(GROUP_GAP)))
      else {
        g.shift(dx)
        const need = rightOffset(Gs, g, constGap(GROUP_GAP))
        g.shift(-dx)
        dx += Math.max(0, need)
      }
      g.shift(dx)
      Gs.merge(g)
      Gs.links.push({
        type: 'children',
        key: `k-${f.id}`,
        familyId: f.id,
        parents: otherNode ? [otherNode, parentNode].sort((p, q) => p.x - q.x) : [parentNode],
        children: kn,
        childLinks: f.childLinks,
      })
    }
    if (!bloodMode) {
      if (faNode && fa) for (const f of faFams) halfGroup(f, faNode, faOther.get(f.id), 'left')
      if (moNode && mo) for (const f of moFams) halfGroup(f, moNode, moOther.get(f.id), 'right')
    }

    const out = new Shape()
    out.merge(upper)
    out.merge(Gs)
    return out
  }

  // ---------------------------------------------------------------------------
  if (!G.person(focusId)) return emptyLayout()
  const S = desc(focusId, 0, opts.down)
  const nodeF = S.nodes.find((n) => n.personId === focusId && n.row === 0)
  nodeF.focus = true
  const all = up(focusId, S, nodeF, 0, opts.up, 'center', withSiblings)

  // Центр — в начале координат
  const dx = -nodeF.x
  for (const n of all.nodes) n.x += dx

  const { shown, bounds } = finishNodes(G, all.nodes, M)
  return { nodes: all.nodes, edges: renderLinks(all.links, all.nodes, M), bounds, focusNode: nodeF, shown, metrics: M }
}

export function emptyLayout(M) {
  return { nodes: [], edges: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, focusNode: null, shown: new Set(), metrics: M }
}
