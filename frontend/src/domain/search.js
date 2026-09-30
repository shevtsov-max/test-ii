/**
 * Поиск людей: без учёта регистра и «ё», по любой части ФИО, девичьей фамилии, прозвищу, году и месту.
 */
import { fullName } from './names'
import { placeName } from './places'

export const normalize = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function personHaystack(tree, p) {
  return normalize(
    [
      fullName(p, { middle: true, title: true }),
      p.birthName,
      p.nickname,
      p.birth.date.year,
      p.death.date.year,
      placeName(tree, p.birth.placeId),
      placeName(tree, p.death.placeId),
      placeName(tree, p.residencePlaceId),
      p.occupation,
    ].join(' '),
  )
}

/**
 * Ранжированный поиск: совпадение с началом имени/фамилии важнее, чем вхождение в середину.
 * @returns {{ person: import('./types').Person, score: number }[]}
 */
export function searchPersons(tree, query, limit = 50) {
  const q = normalize(query)
  const persons = Object.values(tree.persons)
  if (!q) return persons.slice(0, limit).map((person) => ({ person, score: 0 }))
  const parts = q.split(' ')
  const out = []
  for (const p of persons) {
    const hay = personHaystack(tree, p)
    if (!parts.every((x) => hay.includes(x))) continue
    const names = normalize(`${p.firstName} ${p.lastName} ${p.middleName} ${p.birthName} ${p.nickname}`).split(' ')
    let score = 0
    for (const part of parts) {
      if (names.includes(part)) score += 3
      else if (names.some((n) => n.startsWith(part))) score += 2
      else score += 0.5
    }
    out.push({ person: p, score })
  }
  return out.sort((a, b) => b.score - a.score || a.person.lastName.localeCompare(b.person.lastName, 'ru')).slice(0, limit)
}
