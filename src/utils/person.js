export const uid = (prefix = '') => prefix + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 8)

export const emptyDate = () => ({ qualifier: 'exact', day: null, month: null, year: null })
export const emptyEvent = () => ({ date: emptyDate(), place: '' })

export function newPerson(patch = {}) {
  const now = Date.now()
  return {
    id: uid('p'),
    gender: 'U',
    firstName: '',
    middleName: '',
    lastName: '',
    birthName: '',
    nickname: '',
    title: '',
    suffix: '',
    living: true,
    birth: emptyEvent(),
    death: { ...emptyEvent(), cause: '' },
    email: '',
    phone: '',
    avatarId: null,
    photos: [],
    biography: '',
    facts: [],
    createdAt: now,
    updatedAt: now,
    ...patch,
  }
}

export function newFamily(patch = {}) {
  return {
    id: uid('f'),
    partners: [],
    status: 'married',
    marriage: emptyEvent(),
    divorce: emptyEvent(),
    children: [],
    ...patch,
  }
}

export const MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]
export const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

export const QUALIFIERS = [
  { value: 'exact', label: 'Точно', prefix: '' },
  { value: 'about', label: 'Около', prefix: 'ок. ' },
  { value: 'estimated', label: 'Предположительно', prefix: 'предп. ' },
  { value: 'before', label: 'До', prefix: 'до ' },
  { value: 'after', label: 'После', prefix: 'после ' },
  { value: 'between', label: 'Между', prefix: 'между ' },
]

export const hasDate = (d) => !!d && !!(d.year || d.month || d.day)

function formatSingle(day, month, year, short = false) {
  const parts = []
  if (day && month) parts.push(`${day} ${short ? MONTHS_SHORT[month - 1] : MONTHS_GEN[month - 1]}`)
  else if (month) parts.push(short ? MONTHS_SHORT[month - 1] : MONTHS[month - 1].toLowerCase())
  if (year) parts.push(String(year))
  return parts.join(' ')
}

export function formatDate(d, short = false) {
  if (!d || !hasDate(d)) return ''
  const q = QUALIFIERS.find((x) => x.value === d.qualifier)
  const main = formatSingle(d.day, d.month, d.year, short)
  if (d.qualifier === 'between') {
    const second = formatSingle(d.day2, d.month2, d.year2, short)
    return second ? `${main} – ${second}` : main
  }
  return (q?.prefix ?? '') + main
}

export function yearOf(d) {
  return d?.year ?? null
}

export function fullName(p, opts = {}) {
  if (!p) return ''
  const name = [p.title, p.firstName, opts.middle ? p.middleName : '', p.lastName, p.suffix].filter(Boolean).join(' ').trim()
  return name || 'Без имени'
}

export function shortName(p) {
  if (!p) return ''
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Без имени'
}

export function initials(p) {
  if (!p) return '?'
  const a = (p.firstName || '').trim()[0] || ''
  const b = (p.lastName || '').trim()[0] || ''
  return (a + b).toUpperCase() || '?'
}

export function lifeSpan(p) {
  const b = yearOf(p.birth.date)
  const d = yearOf(p.death.date)
  const bq = p.birth.date.qualifier !== 'exact' && b ? '~' : ''
  const dq = p.death.date.qualifier !== 'exact' && d ? '~' : ''
  if (!p.living) {
    if (b && d) return `${bq}${b} – ${dq}${d}`
    if (b) return `${bq}${b} – ?`
    if (d) return `? – ${dq}${d}`
    return 'Умер(ла)'
  }
  return b ? `р. ${bq}${b}` : ''
}

function pluralYears(n) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'год'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'года'
  return 'лет'
}

export function ageOf(p, now = new Date()) {
  const b = p.birth.date
  if (!b.year) return ''
  const end = !p.living ? p.death.date : null
  let endY, endM, endD
  if (end) {
    if (!end.year) return ''
    endY = end.year
    endM = end.month ?? 12
    endD = end.day ?? 31
  } else {
    endY = now.getFullYear()
    endM = now.getMonth() + 1
    endD = now.getDate()
  }
  let age = endY - b.year
  if (b.month && (endM < b.month || (endM === b.month && b.day && endD < b.day))) age--
  if (age < 0 || age > 150) return ''
  const approx = !b.month || b.qualifier !== 'exact' ? '~' : ''
  return `${approx}${age} ${pluralYears(age)}`
}

export const genderLabel = { M: 'Мужчина', F: 'Женщина', U: 'Неизвестно' }

export const FAMILY_STATUSES = [
  { value: 'married', label: 'В браке', icon: 'sym_r_favorite' },
  { value: 'partners', label: 'Партнёры', icon: 'sym_r_handshake' },
  { value: 'engaged', label: 'Помолвлены', icon: 'sym_r_diamond' },
  { value: 'separated', label: 'Раздельно', icon: 'sym_r_call_split' },
  { value: 'divorced', label: 'В разводе', icon: 'sym_r_heart_broken' },
  { value: 'widowed', label: 'Вдовство', icon: 'sym_r_local_florist' },
  { value: 'unknown', label: 'Неизвестно', icon: 'sym_r_help' },
]

export const FACT_TYPES = [
  { value: 'baptism', label: 'Крещение', icon: 'sym_r_water_drop' },
  { value: 'education', label: 'Образование', icon: 'sym_r_school' },
  { value: 'occupation', label: 'Профессия', icon: 'sym_r_work' },
  { value: 'residence', label: 'Место жительства', icon: 'sym_r_home' },
  { value: 'military', label: 'Военная служба', icon: 'sym_r_military_tech' },
  { value: 'award', label: 'Награда', icon: 'sym_r_workspace_premium' },
  { value: 'emigration', label: 'Эмиграция', icon: 'sym_r_flight_takeoff' },
  { value: 'immigration', label: 'Иммиграция', icon: 'sym_r_flight_land' },
  { value: 'religion', label: 'Вероисповедание', icon: 'sym_r_church' },
  { value: 'nationality', label: 'Национальность', icon: 'sym_r_flag' },
  { value: 'burial', label: 'Погребение', icon: 'sym_r_park' },
  { value: 'custom', label: 'Другое событие', icon: 'sym_r_event_note' },
]

export const TITLES = ['Д-р', 'Проф.', 'Акад.', 'Св.', 'Кн.', 'Гр.', 'Ген.', 'Полк.', 'Кап.', 'Лейт.', 'Отец', 'Мать']
export const SUFFIXES = ['старший', 'младший', 'I', 'II', 'III', 'IV']

export function sortKey(d) {
  if (!d?.year) return Number.MAX_SAFE_INTEGER
  return d.year * 10000 + (d.month ?? 0) * 100 + (d.day ?? 0)
}

export function genderColor(g) {
  return g === 'M' ? 'male' : g === 'F' ? 'female' : 'unknown'
}
