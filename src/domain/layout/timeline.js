/**
 * Лента жизни: полосы продолжительности жизни на оси времени. Видно, чьи жизни пересекались,
 * кто кого застал, в какую эпоху жило каждое поколение.
 */
import { yearOf } from '../dates'

/**
 * @param {import('../graph').FamilyGraph} G
 * @param {string[]} personIds
 * @param {Map<string, number>} [generations] поколение относительно центра (для группировки)
 */
export function computeTimeline(G, personIds, generations = new Map()) {
  const nowYear = new Date().getFullYear()
  const rows = []
  for (const id of personIds) {
    const p = G.person(id)
    if (!p) continue
    const by = yearOf(p.birth.date)
    let dy = p.living ? nowYear : yearOf(p.death.date)
    let start = by
    let approxEnd = false
    let approxStart = p.birth.date.qualifier !== 'exact'
    if (!start && dy) {
      start = dy - 60
      approxStart = true
    }
    if (!start) continue
    if (!dy) {
      dy = Math.min(nowYear, start + 70)
      approxEnd = true
    }
    const events = []
    for (const f of G.spouseFamilies(id)) {
      if (f.marriage.date.year) events.push({ year: f.marriage.date.year, kind: 'marriage' })
      for (const c of f.children) {
        const cy = yearOf(G.person(c)?.birth.date)
        if (cy) events.push({ year: cy, kind: 'child', personId: c })
      }
    }
    for (const e of p.events) if (e.date.year) events.push({ year: e.date.year, kind: e.type })
    rows.push({
      personId: id,
      start,
      end: Math.max(dy, start),
      living: p.living,
      approxStart,
      approxEnd,
      events,
      generation: generations.get(id) ?? 0,
    })
  }
  rows.sort((a, b) => a.generation - b.generation || a.start - b.start)
  const minYear = rows.length ? Math.floor(Math.min(...rows.map((r) => r.start)) / 10) * 10 - 5 : nowYear - 100
  const maxYear = rows.length ? Math.min(nowYear + 5, Math.ceil(Math.max(...rows.map((r) => r.end)) / 10) * 10 + 5) : nowYear
  return { rows, minYear, maxYear, nowYear }
}
