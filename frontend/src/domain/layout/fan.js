/**
 * Веерная диаграмма предков: центр — персона, кольца — поколения, отец слева, мать справа.
 */

const rad = (a) => (a * Math.PI) / 180
export const polar = (r, a) => [r * Math.cos(rad(a)), r * Math.sin(rad(a))]

export function arcPath(r0, r1, a0, a1) {
  const large = a1 - a0 > 180 ? 1 : 0
  const [x0, y0] = polar(r1, a0)
  const [x1, y1] = polar(r1, a1)
  const [x2, y2] = polar(r0, a1)
  const [x3, y3] = polar(r0, a0)
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`
}

/**
 * @param {import('../graph').FamilyGraph} G
 * @param {{ generations: number, span?: number, placeholders?: boolean }} opts
 */
export function computeFan(G, focusId, opts) {
  const gens = Math.min(Math.max(opts.generations, 2), 9)
  const SPAN = opts.span ?? 240
  const START = -90 - SPAN / 2
  const R0 = 96
  const ringW = (g) => (g <= 2 ? 100 : g <= 4 ? 86 : g <= 6 ? 74 : 62)
  const inner = (g) => {
    let r = R0
    for (let i = 1; i < g; i++) r += ringW(i)
    return r
  }
  const sectors = []
  const walk = (pid, gen, idx, line) => {
    if (gen >= gens) return
    const { father, mother, family } = G.parents(pid)
    const full = (family?.partners.length ?? 0) >= 2
    const parents = [
      [father, 'father'],
      [mother, 'mother'],
    ]
    parents.forEach(([par, role], j) => {
      const g = gen + 1
      const i = idx * 2 + j
      const count = 2 ** g
      const a0 = START + (SPAN / count) * i
      const a1 = a0 + SPAN / count
      const r0 = inner(g)
      const r1 = r0 + ringW(g)
      if (!par && (full || opts.placeholders === false || g > 4)) return
      sectors.push({
        key: `${g}-${i}`,
        gen: g,
        idx: i,
        personId: par ?? null,
        forId: par ? null : pid,
        role,
        line: gen === 0 ? role : line,
        d: arcPath(r0 + 1.5, r1 - 1.5, a0 + 0.3, a1 - 0.3),
        a0,
        a1,
        r0,
        r1,
      })
      if (par) walk(par, g, i, gen === 0 ? role : line)
    })
  }
  if (G.person(focusId)) walk(focusId, 0, 0, null)
  const outer = inner(gens) + ringW(gens)
  const Rr = outer + 14
  const bottom = Math.max(R0 + 76, Rr * Math.sin(rad(SPAN / 2 - 90)) + 24)
  return { sectors, R0, outer, viewBox: { x: -Rr, y: -Rr, w: Rr * 2, h: Rr + bottom }, gens }
}

/** Подпись сектора: радиальная для узких, по дуге — для широких. */
export function sectorLabel(s, person, lifeSpan) {
  const mid = (s.a0 + s.a1) / 2
  const rMid = (s.r0 + s.r1) / 2
  const arcLen = rad(s.a1 - s.a0) * rMid
  const radial = arcLen < 96
  const [x, y] = polar(rMid, mid)
  let rot = radial ? mid : mid + 90
  if (radial && (mid > 90 || mid < -90)) rot += 180
  if (!radial && Math.sin(rad(mid)) > 0.2) rot += 180
  const width = radial ? s.r1 - s.r0 - 10 : arcLen - 12
  const size = s.gen <= 1 ? 13.5 : s.gen <= 3 ? 12 : s.gen <= 5 ? 10.5 : 9
  const maxChars = Math.max(3, Math.floor(width / (size * 0.56)))
  const cut = (t) => (t.length > maxChars ? t.slice(0, maxChars - 1) + '…' : t)
  return {
    x,
    y,
    rot,
    size,
    first: cut(person.firstName || '—'),
    last: s.gen <= 6 ? cut(person.lastName || person.birthName || '') : '',
    years: s.gen <= 4 ? cut(lifeSpan) : '',
  }
}
