/**
 * Измерение текста для SVG-карточек: перенос имён по словам и многоточие.
 * Ширина считается на canvas с тем же шрифтом, что и в интерфейсе.
 */
const cache = new Map()
let ctx = null

export const FONT_FAMILY = '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
export const font = (size, weight = 500) => `${weight} ${size}px ${FONT_FAMILY}`

export function textWidth(s, f) {
  const key = f + '\u0000' + s
  let w = cache.get(key)
  if (w !== undefined) return w
  if (!ctx) {
    if (typeof document === 'undefined') return s.length * 7
    ctx = document.createElement('canvas').getContext('2d')
  }
  ctx.font = f
  w = ctx.measureText(s).width
  if (cache.size > 20000) cache.clear()
  cache.set(key, w)
  return w
}

/** Обрезать строку с «…», чтобы влезла в maxWidth. */
export function ellipsize(s, f, maxWidth) {
  if (!s) return ''
  if (textWidth(s, f) <= maxWidth) return s
  let lo = 0
  let hi = s.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (textWidth(s.slice(0, mid).trimEnd() + '…', f) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return lo ? s.slice(0, lo).trimEnd() + '…' : '…'
}

/** Перенос по словам в не более чем `lines` строк; последняя — с многоточием. */
export function wrapText(s, f, maxWidth, lines = 2) {
  const words = String(s ?? '')
    .split(/\s+/)
    .filter(Boolean)
  const out = []
  let cur = ''
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const next = cur ? cur + ' ' + w : w
    if (textWidth(next, f) <= maxWidth) {
      cur = next
      continue
    }
    if (out.length === lines - 1) {
      out.push(ellipsize([cur, ...words.slice(i)].filter(Boolean).join(' '), f, maxWidth))
      return out
    }
    if (cur) out.push(cur)
    cur = textWidth(w, f) <= maxWidth ? w : ellipsize(w, f, maxWidth)
  }
  if (cur) out.push(cur)
  return out
}

/** Сбросить кеш после загрузки шрифтов. */
export function resetTextCache() {
  cache.clear()
}
