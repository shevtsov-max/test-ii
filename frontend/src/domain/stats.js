/**
 * Статистика древа и лента событий (рождения, браки, смерти, события жизни) с годовщинами.
 */
import { formatDate, hasDate, monthDay, sortKey, todayDate, yearsBetween } from './dates'
import { eventTitle, eventTypeInfo, statusInfo } from './model'
import { shortName } from './names'
import { placeName } from './places'

const top = (map, n = 10) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'ru'))
    .slice(0, n)
    .map(([label, value]) => ({ label, value }))

const bump = (map, key, by = 1) => key && map.set(key, (map.get(key) ?? 0) + by)

/** Фамилия в мужской форме для группировки: «Орлова» → «Орлов», «Шарлотта Прусская» → «Прусский». */
function surnameKey(s) {
  const last = (s ?? '').trim().split(/\s+/).at(-1) ?? ''
  return last.replace(/(ова|ева|ёва|ина|ына)$/, (m) => m.slice(0, -1)).replace(/ская$/, 'ский').replace(/цкая$/, 'цкий')
}

/**
 * @param {import('./graph').FamilyGraph} G
 */
export function treeStats(G) {
  const t = G.tree
  const persons = Object.values(t.persons)
  const s = {
    persons: persons.length,
    families: Object.keys(t.families).length,
    media: Object.keys(t.media ?? {}).length,
    places: Object.keys(t.places ?? {}).length,
    sources: Object.keys(t.sources ?? {}).length,
    male: 0,
    female: 0,
    unknownGender: 0,
    living: 0,
    deceased: 0,
    withPhoto: 0,
    withBirthDate: 0,
    withParents: 0,
    surnames: [],
    maleNames: [],
    femaleNames: [],
    birthPlaces: [],
    byCentury: [],
    byDecade: [],
    lifespanByCentury: [],
    avgLifespan: null,
    oldest: null,
    earliest: null,
    largestFamilies: [],
    generations: 0,
    avgChildren: null,
  }
  const surnames = new Map()
  const maleNames = new Map()
  const femaleNames = new Map()
  const places = new Map()
  const decades = new Map()
  const lifeByCentury = new Map()
  let lifeSum = 0
  let lifeN = 0

  for (const p of persons) {
    if (p.gender === 'M') s.male++
    else if (p.gender === 'F') s.female++
    else s.unknownGender++
    if (p.living) s.living++
    else s.deceased++
    if (p.avatarId) s.withPhoto++
    if (hasDate(p.birth.date)) s.withBirthDate++
    if (G.parentFamily(p.id)) s.withParents++
    bump(surnames, surnameKey(p.birthName || p.lastName))
    if (p.firstName) bump(p.gender === 'F' ? femaleNames : maleNames, p.firstName)
    bump(places, placeName(t, p.birth.placeId))
    const by = p.birth.date.year
    if (by) {
      bump(decades, Math.floor(by / 10) * 10)
      if (!s.earliest || by < G.person(s.earliest).birth.date.year) s.earliest = p.id
    }
    if (!p.living) {
      const age = yearsBetween(p.birth.date, p.death.date)
      if (age && age.years >= 0) {
        lifeSum += age.years
        lifeN++
        const c = Math.floor((by - 1) / 100) + 1
        const cur = lifeByCentury.get(c) ?? { sum: 0, n: 0 }
        cur.sum += age.years
        cur.n++
        lifeByCentury.set(c, cur)
        if (!s.oldest || age.years > s.oldest.years) s.oldest = { id: p.id, years: age.years }
      }
    }
  }
  s.surnames = top(surnames, 12)
  s.maleNames = top(maleNames, 10)
  s.femaleNames = top(femaleNames, 10)
  s.birthPlaces = top(places, 10)
  s.byDecade = [...decades.entries()].sort((a, b) => a[0] - b[0]).map(([label, value]) => ({ label, value }))
  const centuries = new Map()
  for (const { label, value } of s.byDecade) bump(centuries, Math.floor((label - 1) / 100) + 1 || 1, value)
  s.byCentury = [...centuries.entries()].sort((a, b) => a[0] - b[0]).map(([label, value]) => ({ label, value }))
  s.lifespanByCentury = [...lifeByCentury.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([label, v]) => ({ label, value: Math.round(v.sum / v.n), n: v.n }))
  s.avgLifespan = lifeN ? Math.round(lifeSum / lifeN) : null

  const fams = Object.values(t.families)
  s.largestFamilies = fams
    .filter((f) => f.children.length)
    .sort((a, b) => b.children.length - a.children.length)
    .slice(0, 5)
    .map((f) => ({ familyId: f.id, partners: f.partners, children: f.children.length }))
  const withKids = fams.filter((f) => f.partners.length && f.children.length)
  s.avgChildren = withKids.length ? Math.round((withKids.reduce((x, f) => x + f.children.length, 0) / withKids.length) * 10) / 10 : null

  // Глубина: самая длинная линия предков от любого человека
  let depth = 0
  for (const p of persons) {
    if (G.spouseFamilies(p.id).some((f) => f.children.length)) continue
    for (const d of G.ancestorDistances(p.id, 'all').values()) depth = Math.max(depth, d + 1)
  }
  s.generations = depth
  return s
}

/**
 * Все события древа по времени.
 * @returns {{ key: string, kind: string, icon: string, title: string, date: object, sort: number, placeId: string | null, personIds: string[], familyId?: string, description?: string }[]}
 */
export function allEvents(G) {
  const t = G.tree
  const out = []
  for (const p of Object.values(t.persons)) {
    if (hasDate(p.birth.date) || p.birth.placeId)
      out.push({ key: 'b-' + p.id, kind: 'birth', icon: 'sym_r_child_friendly', title: 'Рождение', date: p.birth.date, placeId: p.birth.placeId, personIds: [p.id] })
    if (!p.living && (hasDate(p.death.date) || p.death.placeId))
      out.push({ key: 'd-' + p.id, kind: 'death', icon: 'sym_r_deceased', title: 'Смерть', date: p.death.date, placeId: p.death.placeId, personIds: [p.id], description: p.death.cause })
    for (const e of p.events) {
      out.push({
        key: 'e-' + e.id,
        kind: e.type,
        icon: eventTypeInfo(e.type).icon,
        title: eventTitle(e),
        date: e.date,
        placeId: e.placeId,
        personIds: [p.id],
        eventId: e.id,
        description: e.description,
      })
    }
  }
  for (const f of Object.values(t.families)) {
    if (f.partners.length && (hasDate(f.marriage.date) || f.marriage.placeId))
      out.push({
        key: 'm-' + f.id,
        kind: 'marriage',
        icon: f.status === 'engaged' ? 'sym_r_diamond' : 'sym_r_favorite',
        title: f.status === 'engaged' ? 'Помолвка' : f.status === 'partners' ? 'Начало отношений' : 'Брак',
        date: f.marriage.date,
        placeId: f.marriage.placeId,
        personIds: [...f.partners],
        familyId: f.id,
      })
    if (f.status === 'divorced' && (hasDate(f.divorce.date) || f.divorce.placeId))
      out.push({ key: 'dv-' + f.id, kind: 'divorce', icon: statusInfo('divorced').icon, title: 'Развод', date: f.divorce.date, placeId: f.divorce.placeId, personIds: [...f.partners], familyId: f.id })
  }
  for (const e of out) e.sort = sortKey(e.date)
  return out.sort((a, b) => a.sort - b.sort)
}

/**
 * Ближайшие годовщины: дни рождения живых, памятные даты, годовщины свадеб.
 * @param {number} days горизонт в днях
 */
export function upcomingAnniversaries(G, days = 30, today = todayDate()) {
  const t = G.tree
  const start = new Date(today.year, today.month - 1, today.day)
  const out = []
  const add = (d, kind, personIds, extra = {}) => {
    const md = monthDay(d)
    if (!md) return
    let next = new Date(today.year, md.month - 1, md.day)
    if (next < start) next = new Date(today.year + 1, md.month - 1, md.day)
    const inDays = Math.round((next - start) / 86400000)
    if (inDays > days) return
    const years = d.year ? next.getFullYear() - d.year : null
    out.push({ key: `${kind}-${personIds.join('-')}`, kind, personIds, inDays, date: d, years, when: next, ...extra })
  }
  for (const p of Object.values(t.persons)) {
    if (p.living) add(p.birth.date, 'birthday', [p.id])
    else {
      add(p.birth.date, 'memory-birth', [p.id])
      add(p.death.date, 'memory-death', [p.id])
    }
  }
  for (const f of Object.values(t.families)) {
    if (f.partners.length === 2 && ['married', 'widowed'].includes(f.status) && f.partners.every((x) => t.persons[x]?.living))
      add(f.marriage.date, 'wedding', [...f.partners], { familyId: f.id })
  }
  return out.sort((a, b) => a.inDays - b.inDays)
}

export function anniversaryText(G, a) {
  const names = a.personIds.map((id) => shortName(G.person(id))).join(' и ')
  const y = a.years
  switch (a.kind) {
    case 'birthday':
      return { title: names, text: y ? `День рождения — исполнится ${y}` : 'День рождения' }
    case 'memory-birth':
      return { title: names, text: y ? `${y} лет со дня рождения` : 'День рождения' }
    case 'memory-death':
      return { title: names, text: y ? `${y} лет со дня смерти` : 'День памяти' }
    case 'wedding':
      return { title: names, text: y ? `Годовщина свадьбы — ${y}` : 'Годовщина свадьбы' }
    default:
      return { title: names, text: formatDate(a.date) }
  }
}
