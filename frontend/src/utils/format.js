/**
 * Форматирование для интерфейса: «2 часа назад», числа с падежами.
 */
import { plural } from '@/domain/dates'

export { plural }

export function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const m = Math.round(diff / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} ${plural(m, 'минуту', 'минуты', 'минут')} назад`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} ${plural(h, 'час', 'часа', 'часов')} назад`
  const d = Math.round(h / 24)
  if (d === 1) return 'вчера'
  if (d < 7) return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d > 300 ? 'numeric' : undefined })
}

export const persons = (n) => `${n} ${plural(n, 'персона', 'персоны', 'персон')}`
export const count = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`
