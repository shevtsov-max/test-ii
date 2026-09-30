/**
 * Иконки Material Symbols как SVG-пути — для рисования прямо в схеме (и в экспорте).
 * Формат строк Quasar: "path1&&path2|viewBox".
 */
import { ICONS } from '@/icons.generated'

const cache = new Map()

/** @returns {{ paths: string[], viewBox: string } | null} */
export function svgIcon(name) {
  if (cache.has(name)) return cache.get(name)
  const raw = ICONS[name]
  if (!raw) return null
  const [body, viewBox = '0 0 24 24'] = raw.split('|')
  const paths = body.split('&&').map((p) => p.split('@@')[0])
  const v = { paths, viewBox }
  cache.set(name, v)
  return v
}
