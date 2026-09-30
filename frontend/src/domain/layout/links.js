/**
 * Построение линий схемы по узлам: линия пары (горизонталь между карточками или дуга над ними)
 * и «шина» от пары к детям. Шины разных семей между одними и теми же строками раскладываются
 * по дорожкам (track), чтобы горизонтальные отрезки не накладывались друг на друга.
 */

/**
 * @typedef {object} LinkSpec
 * @property {'couple' | 'children'} type
 * @property {string} key
 * @property {string | null} familyId
 * @property {string} [status]
 * @property {boolean} [dashed]
 * @property {object} [a] узел
 * @property {object} [b] узел
 * @property {object[]} [parents]
 * @property {object[]} [children]
 * @property {Record<string, string>} [childLinks]
 */

/**
 * @typedef {object} Edge
 * @property {string} key
 * @property {'couple' | 'arc' | 'child' | 'bar' | 'far'} kind
 * @property {string} d SVG path
 * @property {boolean} dashed
 * @property {string | null} familyId
 * @property {string} [status]
 * @property {string} [childLink] тип связи ребёнка (adopted, foster…)
 * @property {string[]} persons кого соединяет линия (для подсветки)
 * @property {{ x: number, y: number } | undefined} [badge] значок статуса пары
 */

const cardTop = (n, M) => n.row * M.ROW_H + (M.H - n.h) / 2
const cardBottom = (n, M) => cardTop(n, M) + n.h
const midY = (n, M) => n.row * M.ROW_H + M.H / 2
const pid = (n) => (n.kind === 'person' ? n.personId : null)

/**
 * @param {LinkSpec[]} links
 * @param {object[]} nodes
 * @param {ReturnType<import('./metrics').chartMetrics>} M
 * @returns {Edge[]}
 */
export function renderLinks(links, nodes, M) {
  const R = M.R
  const out = []
  const byRow = new Map()
  for (const n of nodes) {
    const arr = byRow.get(n.row) ?? []
    arr.push(n.x)
    byRow.set(n.row, arr)
  }
  /** Между a и b в строке нет других карточек */
  const adjacent = (a, b) => {
    if (a.row !== b.row) return false
    const lo = Math.min(a.x, b.x)
    const hi = Math.max(a.x, b.x)
    return !(byRow.get(a.row) ?? []).some((x) => x > lo + 1 && x < hi - 1)
  }

  // ------------------------------------------------------------ пары
  const arcs = []
  for (const l of links) {
    if (l.type !== 'couple') continue
    const [a, b] = l.a.x <= l.b.x ? [l.a, l.b] : [l.b, l.a]
    const persons = [pid(a), pid(b)].filter(Boolean)
    if (a.row !== b.row) {
      // Партнёры в разных поколениях (редкий случай) — плавная кривая между карточками
      const x1 = a.x
      const y1 = a.row < b.row ? cardBottom(a, M) : cardTop(a, M)
      const x2 = b.x
      const y2 = a.row < b.row ? cardTop(b, M) : cardBottom(b, M)
      const my = (y1 + y2) / 2
      out.push({ key: l.key, kind: 'far', d: `M ${x1} ${y1} C ${x1} ${my} ${x2} ${my} ${x2} ${y2}`, dashed: true, familyId: l.familyId, status: l.status, persons })
      continue
    }
    if (adjacent(a, b)) {
      const y = midY(a, M)
      const ax = a.x + a.w / 2
      const bx = b.x - b.w / 2
      out.push({
        key: l.key,
        kind: 'couple',
        d: `M ${ax} ${y} L ${bx} ${y}`,
        dashed: !!l.dashed,
        familyId: l.familyId,
        status: l.status,
        persons,
        badge: !l.dashed && l.familyId ? { x: (ax + bx) / 2, y } : undefined,
      })
    } else arcs.push({ l, a, b, persons })
  }
  // Дуги над карточками: вложенные поднимаются выше
  arcs.sort((p, q) => Math.abs(p.b.x - p.a.x) - Math.abs(q.b.x - q.a.x))
  const placedArcs = []
  for (const arc of arcs) {
    const lo = arc.a.x
    const hi = arc.b.x
    let level = 0
    for (const o of placedArcs) {
      if (o.row === arc.a.row && o.lo < hi && o.hi > lo) level = Math.max(level, o.level + 1)
    }
    placedArcs.push({ row: arc.a.row, lo, hi, level })
    const y0 = cardTop(arc.a, M)
    const top = arc.a.row * M.ROW_H - 16 - level * 9
    const x1 = arc.a.x + arc.a.w / 4
    const x2 = arc.b.x - arc.b.w / 4
    out.push({
      key: arc.l.key,
      kind: 'arc',
      d: `M ${x1} ${y0} L ${x1} ${top + R} Q ${x1} ${top} ${x1 + R} ${top} L ${x2 - R} ${top} Q ${x2} ${top} ${x2} ${top + R} L ${x2} ${y0}`,
      dashed: !!arc.l.dashed,
      familyId: arc.l.familyId,
      status: arc.l.status,
      persons: arc.persons,
      badge: arc.l.familyId && !arc.l.dashed ? { x: (x1 + x2) / 2, y: top } : undefined,
    })
  }

  // ------------------------------------------------------------ дети
  const drops = []
  for (const l of links) {
    if (l.type !== 'children' || !l.children.length) continue
    const kids = l.children
    const childRow = Math.min(...kids.map((k) => k.row))
    const persons = [...l.parents.map(pid), ...kids.map(pid)].filter(Boolean)
    let ax
    let ay
    if (l.parents.length === 2) {
      const [p, q] = l.parents[0].x <= l.parents[1].x ? l.parents : [l.parents[1], l.parents[0]]
      if (adjacent(p, q)) {
        ax = (p.x + p.w / 2 + q.x - q.w / 2) / 2
        ay = midY(p, M)
      } else {
        const c = kids.reduce((s, k) => s + k.x, 0) / kids.length
        const near = Math.abs(p.x - c) < Math.abs(q.x - c) ? p : q
        ax = near.x
        ay = cardBottom(near, M)
      }
    } else if (l.parents.length === 1) {
      ax = l.parents[0].x
      ay = cardBottom(l.parents[0], M)
    } else {
      // Родители неизвестны — просто шина над детьми
      const xs = kids.map((k) => k.x)
      const busY = childRow * M.ROW_H - M.ROW_GAP / 2
      out.push({ key: l.key + '-bar', kind: 'bar', d: `M ${Math.min(...xs)} ${busY} L ${Math.max(...xs)} ${busY}`, dashed: true, familyId: l.familyId, persons })
      for (const k of kids)
        out.push({ key: `${l.key}-${k.key}`, kind: 'child', d: `M ${k.x} ${busY} L ${k.x} ${cardTop(k, M)}`, dashed: true, familyId: l.familyId, persons: [pid(k)].filter(Boolean) })
      continue
    }
    const xs = [ax, ...kids.map((k) => k.x)]
    drops.push({ l, ax, ay, kids, childRow, lo: Math.min(...xs), hi: Math.max(...xs), persons, parentIds: l.parents.map(pid).filter(Boolean) })
  }

  // Дорожки шин по строкам
  const rows = new Map()
  for (const d of drops) {
    const arr = rows.get(d.childRow) ?? []
    arr.push(d)
    rows.set(d.childRow, arr)
  }
  for (const [row, list] of rows) {
    list.sort((p, q) => p.lo - q.lo || p.hi - q.hi)
    const trackEnds = []
    for (const d of list) {
      // Отрезок нулевой ширины (ребёнок ровно под парой) дорожку не занимает
      if (d.hi - d.lo < 1) {
        d.track = -1
        continue
      }
      let t = trackEnds.findIndex((end) => end < d.lo - 8)
      if (t < 0) {
        t = trackEnds.length
        trackEnds.push(d.hi)
      } else trackEnds[t] = d.hi
      d.track = t
    }
    const n = Math.max(1, trackEnds.length)
    const room = Math.max(0, M.ROW_GAP - 44)
    const step = n > 1 ? Math.min(9, room / (n - 1)) : 0
    const base = row * M.ROW_H - M.ROW_GAP / 2
    for (const d of list) d.busY = base + (Math.max(0, d.track) - (n - 1) / 2) * step
  }

  for (const d of drops) {
    const { ax, ay, busY, l } = d
    for (const k of d.kids) {
      const cx = k.x
      const top = cardTop(k, M)
      const dx = cx - ax
      const r = Math.min(R, Math.abs(dx) / 2, Math.abs(busY - ay) / 2)
      const s = Math.sign(dx) || 1
      // Скругляем только настоящие углы (на концах шины). В Т-образных развилках линии разных детей
      // расходятся в разные стороны — скругления там рисуют «двойную» линию, поэтому угол прямой.
      const atEnd = (x) => x <= d.lo + 0.5 || x >= d.hi - 0.5
      const ra = atEnd(ax) ? r : 0
      const rc = atEnd(cx) ? r : 0
      // Одинаковая структура команд — чтобы CSS-переход по `d` работал плавно
      const path =
        `M ${ax} ${ay} L ${ax} ${busY - ra} Q ${ax} ${busY} ${ax + s * ra} ${busY} ` +
        `L ${cx - s * rc} ${busY} Q ${cx} ${busY} ${cx} ${busY + rc} L ${cx} ${top}`
      const link = l.childLinks?.[pid(k)]
      out.push({
        key: `${l.key}-${k.key}`,
        kind: 'child',
        d: path,
        dashed: !!l.dashed || (!!link && link !== 'birth'),
        childLink: link && link !== 'birth' ? link : undefined,
        familyId: l.familyId,
        persons: [...d.parentIds, pid(k)].filter(Boolean),
      })
    }
  }

  // Одна семья может быть нарисована дважды (персона встречается в нескольких местах) — ключи уникальны
  const seen = new Map()
  for (const o of out) {
    const n = (seen.get(o.key) ?? 0) + 1
    seen.set(o.key, n)
    if (n > 1) o.key = `${o.key}~${n}`
  }
  return out
}

/** Флаги «есть скрытые предки/потомки» и границы схемы. */
export function finishNodes(G, nodes, M) {
  const shown = new Set()
  for (const n of nodes) if (n.personId) shown.add(n.personId)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    n.left = n.x - n.w / 2
    n.top = cardTop(n, M)
    minX = Math.min(minX, n.left)
    maxX = Math.max(maxX, n.left + n.w)
    minY = Math.min(minY, n.top)
    maxY = Math.max(maxY, n.top + n.h)
    if (n.personId) {
      const pf = G.parentFamily(n.personId)
      n.moreUp = !!pf && pf.partners.length > 0 && !pf.partners.some((p) => shown.has(p))
      const kids = G.children(n.personId)
      n.moreDown = kids.length > 0 && !kids.some((k) => shown.has(k))
      n.hiddenKids = n.moreDown ? kids.length : 0
    }
  }
  if (!nodes.length) minX = minY = maxX = maxY = 0
  return { shown, bounds: { minX, minY: minY - 30, maxX, maxY } }
}
