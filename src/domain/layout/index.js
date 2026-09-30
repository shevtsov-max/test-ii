/**
 * Единая точка входа для раскладок древа.
 */
import { computeHourglass } from './hourglass'
import { computeLayered } from './layered'
import { computePedigree } from './pedigree'
import { chartMetrics, generationLabel } from './metrics'
import { yearOf } from '../dates'

export { chartMetrics, generationLabel } from './metrics'
export { computeFan, sectorLabel, arcPath, polar } from './fan'
export { computeTimeline } from './timeline'

/** Охваты схемы «Древо» — как в меню «Построить дерево». */
export const CHART_SCOPES = [
  { value: 'direct', label: 'Прямые предки и потомки', short: 'Прямая линия', icon: 'sym_r_linear_scale', hint: 'Только родители, деды, прадеды и дети, внуки' },
  { value: 'family', label: 'Прямая родня, братья и сёстры', short: 'Семья', icon: 'sym_r_family_restroom', hint: 'Плюс братья, сёстры, их семьи и сводные' },
  { value: 'blood', label: 'Кровные родственники', short: 'Кровные', icon: 'sym_r_bloodtype', hint: 'Все, у кого общий предок: двоюродные, троюродные…' },
  { value: 'all', label: 'Все родственники', short: 'Все', icon: 'sym_r_diversity_3', hint: 'Все связанные люди, включая родню супругов' },
]

export const CHART_VIEWS = [
  { value: 'tree', label: 'Древо', icon: 'sym_r_account_tree' },
  { value: 'pedigree', label: 'Родословная', icon: 'sym_r_family_history' },
  { value: 'fan', label: 'Веер', icon: 'sym_r_motion_photos_auto' },
  { value: 'timeline', label: 'Лента жизни', icon: 'sym_r_view_timeline' },
]

/**
 * @param {import('../graph').FamilyGraph} G
 * @param {string} focusId
 * @param {{ view: string, scope: string, up: number, down: number, density: string, placeholders: boolean }} s
 */
export function computeChart(G, focusId, s) {
  const M = chartMetrics(s.density)
  if (s.view === 'pedigree') return { type: 'pedigree', ...computePedigree(G, focusId, { generations: s.up, placeholders: s.placeholders }, M) }
  const layout =
    s.scope === 'all'
      ? computeLayered(G, focusId, { up: s.up, down: s.down }, M)
      : computeHourglass(G, focusId, { up: s.up, down: s.down, scope: s.scope, placeholders: s.placeholders }, M)
  return { type: 'tree', ...layout, rows: rowLabels(G, layout, M) }
}

/** Подписи строк: «Родители · 1920–1960». */
function rowLabels(G, layout, M) {
  const byRow = new Map()
  for (const n of layout.nodes) {
    if (!n.personId) continue
    const y = yearOf(G.person(n.personId)?.birth.date)
    const r = byRow.get(n.row) ?? { min: Infinity, max: -Infinity, n: 0 }
    if (y) {
      r.min = Math.min(r.min, y)
      r.max = Math.max(r.max, y)
    }
    r.n++
    byRow.set(n.row, r)
  }
  return [...byRow.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([row, r]) => ({
      row,
      y: row * M.ROW_H + M.H / 2,
      label: generationLabel(row),
      years: r.min === Infinity ? '' : r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`,
      count: r.n,
    }))
}
