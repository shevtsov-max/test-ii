/**
 * Раскладка «Семейного вида» (hourglass) вокруг центральной персоны.
 *
 * Вниз — потомки (с партнёрами) центральной персоны, её братьев и сестёр.
 * Вверх — прямые предки; у каждого предка показаны его братья/сёстры и
 * другие партнёры (с детьми от них — сводными братьями/сёстрами).
 * Упаковка поддеревьев — контурная (как в алгоритме Reingold–Tilford),
 * поэтому древо получается компактным без пересечений.
 */

import { orderPartners, parentFamily, spouseFamilies, partnerIn, byBirth } from './graph'

export const CARD_W = 196
export const CARD_H = 68
export const PH_W = 94
export const PH_H = 58
export const COUPLE_GAP = 36
/** Зазор между парой заглушек «отец/мать»: 35 = 4 штриха по 5px через 5px — линия симметрично видна у обоих блоков */
export const PH_PAIR_GAP = 35
export const SIB_GAP = 26
export const GROUP_GAP = 44
export const ROW_H = CARD_H + 88

class Shape {
  nodes = []
  links = []
  contour = new Map()

  add(n) {
    this.nodes.push(n)
    this.extend(n.row, n.x - n.w / 2, n.x + n.w / 2)
    return n
  }

  extend(row, a, b) {
    const c = this.contour.get(row)
    if (!c) this.contour.set(row, [a, b])
    else {
      c[0] = Math.min(c[0], a)
      c[1] = Math.max(c[1], b)
    }
  }

  shift(dx) {
    if (!dx) return
    for (const n of this.nodes) n.x += dx
    for (const c of this.contour.values()) {
      c[0] += dx
      c[1] += dx
    }
  }

  merge(o) {
    this.nodes.push(...o.nodes)
    this.links.push(...o.links)
    for (const [r, [a, b]] of o.contour) this.extend(r, a, b)
  }

  get minX() {
    let m = Infinity
    for (const [a] of this.contour.values()) m = Math.min(m, a)
    return m
  }
  get maxX() {
    let m = -Infinity
    for (const [, b] of this.contour.values()) m = Math.max(m, b)
    return m
  }
}

const constGap = (g) => () => g

/** Сдвиг, который нужно применить к B, чтобы он оказался справа от A. */
function rightOffset(A, B, gap) {
  let dx = -Infinity
  let common = false
  for (const [r, [, amax]] of A.contour) {
    const bc = B.contour.get(r)
    if (!bc) continue
    common = true
    dx = Math.max(dx, amax + gap(r) - bc[0])
  }
  if (!common) {
    if (!A.nodes.length || !B.nodes.length) return 0
    return A.maxX + gap(0) - B.minX
  }
  return dx
}

/** Максимальный сдвиг B (может быть отрицательным), при котором B остаётся слева от A. */
function leftLimit(A, B, gap) {
  let dx = Infinity
  for (const [r, [amin]] of A.contour) {
    const bc = B.contour.get(r)
    if (!bc) continue
    dx = Math.min(dx, amin - gap(r) - bc[1])
  }
  return dx
}

function packRow(shapes, gap = constGap(SIB_GAP)) {
  const out = new Shape()
  for (const s of shapes) {
    if (out.nodes.length) s.shift(rightOffset(out, s, gap))
    out.merge(s)
  }
  return out
}

const centerOf = (nodes) => (nodes.length ? (Math.min(...nodes.map((n) => n.x)) + Math.max(...nodes.map((n) => n.x))) / 2 : 0)

export function computeLayout(t, focusId, opts) {
  const expanded = new Set()
  const keyCount = new Map()
  const famCache = new Map()
  const sf = (pid) => {
    let v = famCache.get(pid)
    if (!v) famCache.set(pid, (v = spouseFamilies(t, pid)))
    return v
  }
  const sortBirth = byBirth(t)

  function personNode(pid, row) {
    const n = (keyCount.get(pid) ?? 0) + 1
    keyCount.set(pid, n)
    return {
      key: n === 1 ? pid : `${pid}#${n}`,
      kind: 'person',
      personId: pid,
      x: 0,
      row,
      w: CARD_W,
      h: CARD_H,
      dup: n > 1,
    }
  }

  function placeholder(forId, role, row) {
    return { key: `ph-${role}-${forId}`, kind: 'placeholder', role, forId, x: 0, row, w: PH_W, h: PH_H }
  }

  /**
   * Строка «персона + партнёры». Возвращает узел персоны и узлы партнёров по семьям.
   * sideHint: для предков по отцовской линии других партнёров ставим слева, по материнской — справа.
   */
  function unit(pid, row, sideHint = 'auto') {
    const s = new Shape()
    const fams = sf(pid)
    const withPartner = fams.filter((f) => partnerIn(f, pid))
    const me = personNode(pid, row)
    const gender = t.persons[pid]?.gender
    let order
    const partnerItems = withPartner.map((f) => ({ fam: f }))
    if (sideHint === 'left') order = [...partnerItems.reverse(), me]
    else if (sideHint === 'right') order = [me, ...partnerItems]
    else if (partnerItems.length === 0) order = [me]
    else if (partnerItems.length === 1) order = gender === 'F' ? [partnerItems[0], me] : [me, partnerItems[0]]
    else if (partnerItems.length === 2) order = [partnerItems[0], me, partnerItems[1]]
    else order = gender === 'F' ? [...partnerItems.reverse(), me] : [me, ...partnerItems]

    const partnerNodes = new Map()
    let x = 0
    for (const item of order) {
      let node
      if ('fam' in item) {
        node = personNode(partnerIn(item.fam, pid), row)
        partnerNodes.set(item.fam.id, node)
        s.links.push({
          type: 'couple',
          key: `c-${item.fam.id}`,
          familyId: item.fam.id,
          status: item.fam.status,
          a: x === 0 ? node : me,
          b: x === 0 ? me : node,
        })
      } else node = item
      node.x = x
      s.add(node)
      x += CARD_W + COUPLE_GAP
    }
    // Правильный порядок a/b в связях — слева направо
    for (const l of s.links) {
      if (l.type === 'couple' && l.a.x > l.b.x) [l.a, l.b] = [l.b, l.a]
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
      const kids = [...f.children].sort(sortBirth).filter((k) => t.persons[k])
      if (!kids.length) continue
      const shapes = kids.map((k) => desc(k, row + 1, depth - 1))
      // первичный узел каждого ребёнка
      const primary = shapes.map((sh, i) => sh.nodes.find((n) => n.personId === kids[i] && n.row === row + 1))
      const g = packRow(shapes)
      const pn = u.partnerNodes.get(f.id)
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

  /**
   * Добавляет к фигуре S (содержащей персону X) её братьев/сестёр, родителей и всех предков.
   */
  function up(X, S, nodeX, row, levels, side, sibDesc) {
    const pf = parentFamily(t, X)
    const hasParentsVisible = levels > 0

    if (!pf || !hasParentsVisible) {
      if (!pf && hasParentsVisible && opts.placeholders) {
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

    const [fa, mo] = orderPartners(t, pf)
    const make = (pid) => (sibDesc ? desc(pid, row, opts.down) : flat(pid, row))
    const primaryOf = (sh, pid) => sh.nodes.find((n) => n.personId === pid && n.row === row)

    // --- Полные братья и сёстры
    const sibIds = opts.siblings ? pf.children.filter((c) => c !== X && t.persons[c]).sort(sortBirth) : []
    const sibShapes = sibIds.map((id) => ({ id, shape: make(id) }))
    let ordered
    const self = { id: X, shape: S }
    if (side === 'left') ordered = [...sibShapes, self]
    else if (side === 'right') ordered = [self, ...sibShapes]
    else {
      ordered = [...sibShapes, self].sort((a, b) => sortBirth(a.id, b.id))
    }
    const kidsNodes = ordered.map((o) => (o.id === X ? nodeX : primaryOf(o.shape, o.id)))
    const full = packRow(ordered.map((o) => o.shape))

    // --- Родители (узлы-строки)
    const faFams = fa && opts.siblings ? sf(fa).filter((f) => f.id !== pf.id) : []
    const moFams = mo && opts.siblings ? sf(mo).filter((f) => f.id !== pf.id) : []

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
      const partnered = others.filter((f) => partnerIn(f, pid) && t.persons[partnerIn(f, pid)])
      const items = sideP === 'left' ? [...[...partnered].reverse(), me] : [me, ...partnered]
      let x = 0
      for (const it of items) {
        let n
        if ('partners' in it) {
          const other = partnerIn(it, pid)
          n = personNode(other, row - 1)
          expanded.add(other)
          store.set(it.id, n)
        } else n = it
        n.x = x
        s.add(n)
        x += CARD_W + COUPLE_GAP
      }
      for (const f of partnered) {
        const n = store.get(f.id)
        const [a, b] = n.x < me.x ? [n, me] : [me, n]
        s.links.push({ type: 'couple', key: `c-${f.id}`, familyId: f.id, status: f.status, a, b })
      }
      return { s, me }
    }

    if (fa) {
      const r = buildParentUnit(fa, faFams, 'left', faOther)
      faNode = r.me
      A1 = up(fa, r.s, r.me, row - 1, levels - 1, 'left', false)
    } else if (opts.placeholders) {
      A1 = new Shape()
      faNode = A1.add(placeholder(X, 'father', row - 1))
    }
    if (mo) {
      const r = buildParentUnit(mo, moFams, 'right', moOther)
      moNode = r.me
      A2 = up(mo, r.s, r.me, row - 1, levels - 1, 'right', false)
    } else if (opts.placeholders) {
      A2 = new Shape()
      moNode = A2.add(placeholder(X, 'mother', row - 1))
    }

    const upper = new Shape()
    if (A1) upper.merge(A1)
    if (A2) {
      if (A1) A2.shift(rightOffset(A1, A2, (r) => (r === row - 1 ? COUPLE_GAP : GROUP_GAP)))
      upper.merge(A2)
    }

    let anchor
    if (faNode && moNode) {
      anchor = (faNode.x + moNode.x) / 2
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
    } else anchor = (faNode ?? moNode)?.x ?? 0

    full.shift(anchor - centerOf(kidsNodes))
    const G = new Shape()
    G.merge(full)
    const parentsNodes = [faNode, moNode].filter(Boolean)
    G.links.push({
      type: 'children',
      key: `k-${pf.id}`,
      familyId: pf.id,
      parents: parentsNodes,
      children: kidsNodes,
      dashed: parentsNodes.some((n) => n.kind === 'placeholder') && parentsNodes.every((n) => n.kind === 'placeholder'),
    })

    // --- Сводные братья/сёстры
    const halfGroup = (f, parentNode, otherNode, dir) => {
      const kids = f.children.filter((c) => t.persons[c] && !expanded.has(c)).sort(sortBirth)
      if (!kids.length) return
      const shapes = kids.map((k) => make(k))
      const kn = shapes.map((sh, i) => primaryOf(sh, kids[i]))
      const g = packRow(shapes)
      const a = otherNode ? (otherNode.x + parentNode.x) / 2 : parentNode.x
      let dx = a - centerOf(kn)
      if (dir === 'left') dx = Math.min(dx, leftLimit(G, g, constGap(GROUP_GAP)))
      else {
        g.shift(dx)
        const need = rightOffset(G, g, constGap(GROUP_GAP))
        g.shift(-dx)
        dx += Math.max(0, need)
      }
      g.shift(dx)
      G.merge(g)
      G.links.push({
        type: 'children',
        key: `k-${f.id}`,
        familyId: f.id,
        parents: otherNode ? [otherNode, parentNode].sort((p, q) => p.x - q.x) : [parentNode],
        children: kn,
      })
    }
    if (faNode && fa) for (const f of faFams) halfGroup(f, faNode, faOther.get(f.id), 'left')
    if (moNode && mo) for (const f of moFams) halfGroup(f, moNode, moOther.get(f.id), 'right')

    const out = new Shape()
    out.merge(upper)
    out.merge(G)
    return out
  }

  // ---------------------------------------------------------------------------
  if (!t.persons[focusId]) {
    return { nodes: [], links: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, focusNode: null, shownPersons: new Set() }
  }
  const S = desc(focusId, 0, opts.down)
  const nodeF = S.nodes.find((n) => n.personId === focusId && n.row === 0)
  nodeF.focus = true
  const all = up(focusId, S, nodeF, 0, opts.up, 'center', true)

  // --- Финальные координаты и флаги
  const shown = new Set()
  for (const n of all.nodes) if (n.personId) shown.add(n.personId)
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const n of all.nodes) {
    n.left = n.x - n.w / 2
    n.top = n.row * ROW_H + (CARD_H - n.h) / 2
    minX = Math.min(minX, n.left)
    maxX = Math.max(maxX, n.left + n.w)
    minY = Math.min(minY, n.top)
    maxY = Math.max(maxY, n.top + n.h)
    if (n.personId) {
      const pf = parentFamily(t, n.personId)
      n.moreUp = !!pf && pf.partners.length > 0 && !pf.partners.some((p) => shown.has(p))
      const kids = sf(n.personId).flatMap((f) => f.children)
      n.moreDown = kids.length > 0 && !kids.some((k) => shown.has(k))
    }
  }
  if (!all.nodes.length) minX = minY = maxX = maxY = 0

  return {
    nodes: all.nodes,
    links: renderLinks(all.links, all.nodes),
    bounds: { minX, minY, maxX, maxY },
    focusNode: nodeF,
    shownPersons: shown,
  }
}

// -----------------------------------------------------------------------------
const R = 10

function midY(n) {
  return n.row * ROW_H + CARD_H / 2
}

function renderLinks(links, nodes) {
  const out = []
  const byRow = new Map()
  for (const n of nodes) {
    const arr = byRow.get(n.row) ?? []
    arr.push(n.x)
    byRow.set(n.row, arr)
  }
  /** Между a и b в строке нет других карточек */
  const adjacent = (a, b) => {
    const lo = Math.min(a.x, b.x)
    const hi = Math.max(a.x, b.x)
    return !(byRow.get(a.row) ?? []).some((x) => x > lo + 1 && x < hi - 1)
  }
  for (const l of links) {
    if (l.type === 'couple') {
      const [a, b] = l.a.x <= l.b.x ? [l.a, l.b] : [l.b, l.a]
      const y = midY(a)
      const ax = a.x + a.w / 2
      const bx = b.x - b.w / 2
      if (adjacent(a, b)) {
        out.push({
          key: l.key,
          kind: 'couple',
          d: `M ${ax} ${y} L ${bx} ${y}`,
          dashed: !!l.dashed,
          familyId: l.familyId,
          status: l.status,
          badge: !l.dashed && l.familyId ? { x: (ax + bx) / 2, y } : undefined,
        })
      } else {
        // Непосредственно не соседи — дуга над карточками
        const top = a.row * ROW_H - 16
        const x1 = a.x + a.w / 4
        const x2 = b.x - b.w / 4
        const y0 = a.row * ROW_H
        out.push({
          key: l.key,
          kind: 'couple',
          d: `M ${x1} ${y0} L ${x1} ${top + R} Q ${x1} ${top} ${x1 + R} ${top} L ${x2 - R} ${top} Q ${x2} ${top} ${x2} ${top + R} L ${x2} ${y0}`,
          dashed: !!l.dashed,
          familyId: l.familyId,
          status: l.status,
          badge: l.familyId && !l.dashed ? { x: (x1 + x2) / 2, y: top } : undefined,
        })
      }
      continue
    }

    // children
    const kids = l.children
    if (!kids.length) continue
    const childTop = kids[0].row * ROW_H + (CARD_H - kids[0].h) / 2
    const busY = kids[0].row * ROW_H - (ROW_H - CARD_H) / 2
    let ax
    let ay
    if (l.parents.length === 2) {
      const [p, q] = l.parents[0].x <= l.parents[1].x ? l.parents : [l.parents[1], l.parents[0]]
      if (adjacent(p, q)) {
        ax = (p.x + p.w / 2 + q.x - q.w / 2) / 2
        ay = midY(p)
      } else {
        // дуговая пара — от нижнего края партнёра, ближайшего к детям
        const c = centerOf(kids)
        const near = Math.abs(p.x - c) < Math.abs(q.x - c) ? p : q
        ax = near.x
        ay = near.row * ROW_H + (CARD_H + near.h) / 2
      }
    } else if (l.parents.length === 1) {
      const p = l.parents[0]
      ax = p.x
      ay = p.row * ROW_H + (CARD_H + p.h) / 2 + 12 // под кнопкой «+»
    } else {
      // родители неизвестны — просто шина над детьми
      const xs = kids.map((k) => k.x)
      out.push({
        key: l.key + '-bar',
        kind: 'bar',
        d: `M ${Math.min(...xs)} ${busY} L ${Math.max(...xs)} ${busY}`,
        dashed: true,
        familyId: l.familyId,
      })
      for (const k of kids)
        out.push({
          key: `${l.key}-${k.key}`,
          kind: 'child',
          d: `M ${k.x} ${busY} L ${k.x} ${childTop}`,
          dashed: true,
          familyId: l.familyId,
        })
      continue
    }
    for (const k of kids) {
      const cx = k.x
      const dx = cx - ax
      // Одинаковая структура команд — чтобы CSS-переход по `d` работал плавно
      const r = Math.min(R, Math.abs(dx) / 2)
      const s = Math.sign(dx) || 1
      const d =
        `M ${ax} ${ay} L ${ax} ${busY - r} Q ${ax} ${busY} ${ax + s * r} ${busY} ` +
        `L ${cx - s * r} ${busY} Q ${cx} ${busY} ${cx} ${busY + r} L ${cx} ${childTop}`
      out.push({ key: `${l.key}-${k.key}`, kind: 'child', d, dashed: !!l.dashed, familyId: l.familyId })
    }
  }
  // Одна семья может быть нарисована дважды (персона встречается в дереве в нескольких местах) — ключи должны быть уникальны
  const seen = new Map()
  for (const o of out) {
    const n = (seen.get(o.key) ?? 0) + 1
    seen.set(o.key, n)
    if (n > 1) o.key = `${o.key}~${n}`
  }
  return out
}
