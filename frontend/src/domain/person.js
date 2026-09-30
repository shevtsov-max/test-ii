/**
 * Сведения о персоне для отображения: годы жизни, возраст, основное занятие, полнота данных.
 */
import { formatAge, formatDate, hasDate, todayDate, yearLabel, yearsBetween } from './dates'
import { placeFullName, placeName } from './places'

/** «1868 – 1918», «р. 1991», «~1880 – ?». */
export function lifeSpan(p) {
  if (!p) return ''
  const b = yearLabel(p.birth.date)
  const d = yearLabel(p.death.date)
  if (!p.living) {
    if (b && d) return `${b} – ${d}`
    if (b) return `${b} – ?`
    if (d) return `? – ${d}`
    return ''
  }
  return b ? `р. ${b}` : ''
}

/** Возраст сейчас (живые) или на момент смерти. */
export function ageOf(p, at) {
  if (!p?.birth.date.year) return null
  if (!p.living) return p.death.date.year ? yearsBetween(p.birth.date, p.death.date) : null
  return yearsBetween(p.birth.date, at ?? todayDate())
}
export const ageLabel = (p) => formatAge(ageOf(p))

/** Возраст на дату события. */
export function ageAt(p, date) {
  if (!p?.birth.date.year || !date?.year) return null
  return yearsBetween(p.birth.date, date)
}

/** Основное занятие: поле «Основное занятие» или последняя запись о работе. */
export function mainOccupation(p) {
  if (!p) return ''
  if (p.occupation) return p.occupation
  const jobs = p.events.filter((e) => e.type === 'occupation' && e.description)
  return jobs.length ? jobs[jobs.length - 1].description : ''
}

/** Место жительства: поле персоны или последнее событие «Место жительства». */
export function residenceId(p) {
  if (!p) return null
  if (p.residencePlaceId) return p.residencePlaceId
  const r = p.events.filter((e) => e.type === 'residence' && e.placeId)
  return r.length ? r[r.length - 1].placeId : null
}

export function birthLine(tree, p, style = 'long') {
  const d = formatDate(p.birth.date, style)
  const place = placeName(tree, p.birth.placeId)
  return [d, place].filter(Boolean).join(', ')
}

export function deathLine(tree, p, style = 'long') {
  if (p.living) return ''
  const d = formatDate(p.death.date, style)
  const place = placeName(tree, p.death.placeId)
  return [d || 'дата неизвестна', place].filter(Boolean).join(', ')
}

export function eventLine(tree, point, style = 'long', full = false) {
  if (!point) return ''
  const d = formatDate(point.date, style)
  const place = full ? placeFullName(tree, point.placeId) : placeName(tree, point.placeId)
  return [d, place].filter(Boolean).join(', ')
}

/**
 * Полнота данных 0…100 и список того, чего не хватает — подсказки «что ещё узнать».
 * @param {import('./graph').FamilyGraph} G
 */
export function completeness(G, p) {
  const checks = [
    { ok: !!p.firstName, weight: 2, hint: 'имя' },
    { ok: !!p.lastName || !!p.birthName, weight: 2, hint: 'фамилия' },
    { ok: !!p.middleName, weight: 1, hint: 'отчество' },
    { ok: p.gender !== 'U', weight: 1, hint: 'пол' },
    { ok: hasDate(p.birth.date), weight: 2, hint: 'дата рождения' },
    { ok: !!p.birth.placeId, weight: 1, hint: 'место рождения' },
    { ok: p.living || hasDate(p.death.date), weight: 2, hint: 'дата смерти' },
    { ok: p.living || !!p.death.placeId, weight: 1, hint: 'место смерти' },
    { ok: !!G.parentFamily(p.id), weight: 2, hint: 'родители' },
    { ok: !!p.avatarId, weight: 1, hint: 'фото' },
    { ok: !!(p.biography || p.note || p.events.length || p.occupation), weight: 1, hint: 'биография или события' },
    { ok: p.citations.length > 0 || p.events.some((e) => e.citations?.length) || (p.birth.citations?.length ?? 0) > 0, weight: 1, hint: 'источники' },
  ]
  const total = checks.reduce((s, c) => s + c.weight, 0)
  const got = checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0)
  return { score: Math.round((got / total) * 100), missing: checks.filter((c) => !c.ok).map((c) => c.hint) }
}

/** Эпитет для умерших по полу: «умер», «умерла». */
export const diedWord = (p) => (p.gender === 'F' ? 'умерла' : p.gender === 'M' ? 'умер' : 'умер(ла)')
export const bornWord = (p) => (p.gender === 'F' ? 'родилась' : p.gender === 'M' ? 'родился' : 'родился(ась)')
