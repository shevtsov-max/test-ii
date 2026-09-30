/**
 * Генеалогические даты: неполные («май 1880»), приблизительные («ок. 1880»), интервалы («между 1880 и 1885»),
 * даты по старому стилю (юлианский календарь). Разбор текста «13.05.1991», «ок. 1880», «1880-е» — parseDateText().
 */

export const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

export const QUALIFIERS = [
  { value: 'exact', label: 'Точно', prefix: '', ged: '' },
  { value: 'about', label: 'Около', prefix: 'ок. ', ged: 'ABT' },
  { value: 'estimated', label: 'Предположительно', prefix: 'предп. ', ged: 'EST' },
  { value: 'calculated', label: 'Вычислено', prefix: 'расч. ', ged: 'CAL' },
  { value: 'before', label: 'До', prefix: 'до ', ged: 'BEF' },
  { value: 'after', label: 'После', prefix: 'после ', ged: 'AFT' },
  { value: 'between', label: 'Между', prefix: 'между ', ged: 'BET' },
]

/** @returns {import('./types').GDate} */
export const emptyDate = () => ({ qualifier: 'exact', day: null, month: null, year: null })

export const hasDate = (d) => !!d && !!(d.year || d.month || d.day || d.text)
export const hasYear = (d) => !!d?.year

export function isValidDay(day, month, year) {
  if (!day) return true
  if (!month) return day >= 1 && day <= 31
  const dim = [31, year && isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  return day >= 1 && day <= dim
}
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

// ------------------------------------------------------------------ юлианский календарь
function jdnFromJulian(y, m, d) {
  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083
}
function jdnFromGregorian(y, m, d) {
  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045
}
function gregorianFromJdn(j) {
  const a = j + 32044
  const b = Math.floor((4 * a + 3) / 146097)
  const c = a - Math.floor((146097 * b) / 4)
  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d) / 4)
  const m = Math.floor((5 * e + 2) / 153)
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  }
}
function julianFromJdn(j) {
  const c = j + 32082
  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d) / 4)
  const m = Math.floor((5 * e + 2) / 153)
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: d - 4800 + Math.floor(m / 10),
  }
}

/** Юлианская дата → григорианская (нужны день, месяц и год). */
export function julianToGregorian(day, month, year) {
  return gregorianFromJdn(jdnFromJulian(year, month, day))
}
export function gregorianToJulian(day, month, year) {
  return julianFromJdn(jdnFromGregorian(year, month, day))
}

/** Дата в григорианском календаре — для сортировки, возраста и годовщин. */
export function toGregorian(d) {
  if (!d || d.calendar !== 'julian' || !d.day || !d.month || !d.year) return d
  return { ...d, ...julianToGregorian(d.day, d.month, d.year), calendar: undefined }
}

// ------------------------------------------------------------------ форматирование
function single(day, month, year, style) {
  if (style === 'numeric') {
    const pad = (n) => String(n).padStart(2, '0')
    if (day && month && year) return `${pad(day)}.${pad(month)}.${year}`
    if (month && year) return `${pad(month)}.${year}`
    if (day && month) return `${pad(day)}.${pad(month)}`
    return year ? String(year) : ''
  }
  const short = style === 'short'
  const parts = []
  if (day && month) parts.push(`${day} ${short ? MONTHS_SHORT[month - 1] : MONTHS_GEN[month - 1]}`)
  else if (month) parts.push(short ? MONTHS_SHORT[month - 1] : MONTHS[month - 1])
  if (year) parts.push(String(year))
  return parts.join(' ')
}

/** «6 (18) мая 1868» — старый стиль с новым в скобках. */
function julianLong(d, style) {
  const g = julianToGregorian(d.day, d.month, d.year)
  const months = style === 'short' ? MONTHS_SHORT : MONTHS_GEN
  if (g.year !== d.year) return `${single(d.day, d.month, d.year, style)} (${single(g.day, g.month, g.year, style)})`
  if (g.month !== d.month) return `${d.day} ${months[d.month - 1]} (${g.day} ${months[g.month - 1]}) ${d.year}`
  return `${d.day} (${g.day}) ${months[d.month - 1]} ${d.year}`
}

/**
 * @param {import('./types').GDate} d
 * @param {'long' | 'short' | 'numeric'} [style]
 */
export function formatDate(d, style = 'long') {
  if (!d) return ''
  if (!d.year && !d.month && !d.day) return d.text ?? ''
  const q = QUALIFIERS.find((x) => x.value === d.qualifier)
  const julian = d.calendar === 'julian'
  let main
  if (julian && d.day && d.month && d.year && style !== 'numeric') main = julianLong(d, style)
  else main = single(d.day, d.month, d.year, style)
  if (d.qualifier === 'between') {
    const second = single(d.day2, d.month2, d.year2, style)
    main = second ? (style === 'long' ? `между ${main} и ${second}` : `${main}–${second}`) : main
  } else main = (q?.prefix ?? '') + main
  if (julian && (style === 'numeric' || !(d.day && d.month && d.year))) main += ' ст. ст.'
  return main
}

/** Год для подписи «1868» или «~1880». */
export function yearLabel(d) {
  if (!d?.year) return ''
  const approx = d.qualifier !== 'exact' && d.qualifier !== 'calculated'
  if (d.qualifier === 'between' && d.year2) return `${d.year}–${d.year2}`
  if (d.qualifier === 'before') return `до ${d.year}`
  if (d.qualifier === 'after') return `после ${d.year}`
  return (approx ? '~' : '') + d.year
}

export const yearOf = (d) => d?.year ?? null

/** Ключ для сортировки (григорианский). Неизвестные даты — в конец. */
export function sortKey(d) {
  if (!d?.year) return Number.MAX_SAFE_INTEGER
  const g = toGregorian(d)
  return g.year * 10000 + (g.month ?? 0) * 100 + (g.day ?? 0)
}

export function compareDates(a, b) {
  return sortKey(a) - sortKey(b)
}

// ------------------------------------------------------------------ возраст
export function pluralYears(n) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'год'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'года'
  return 'лет'
}

export function plural(n, one, few, many) {
  const m10 = Math.abs(n) % 10
  const m100 = Math.abs(n) % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

export function todayDate() {
  const now = new Date()
  return { qualifier: 'exact', day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() }
}

/**
 * Полных лет между датами. `approx` — если одна из дат неточная или неполная.
 * @returns {{ years: number, approx: boolean } | null}
 */
export function yearsBetween(from, to) {
  if (!from?.year || !to?.year) return null
  const a = toGregorian(from)
  const b = toGregorian(to)
  let years = b.year - a.year
  if (a.month && b.month && (b.month < a.month || (b.month === a.month && a.day && b.day && b.day < a.day))) years--
  if (years < 0 || years > 150) return null
  const approx = !a.month || !b.month || a.qualifier !== 'exact' || b.qualifier !== 'exact' || (!a.day && a.month === b.month)
  return { years, approx }
}

export function formatAge(r) {
  if (!r) return ''
  return `${r.approx ? '~' : ''}${r.years} ${pluralYears(r.years)}`
}

// ------------------------------------------------------------------ разбор текста
const MONTH_WORDS = [
  ['январ', 'янв'],
  ['феврал', 'фев'],
  ['март', 'мар'],
  ['апрел', 'апр'],
  ['мая', 'май', 'мае'],
  ['июн'],
  ['июл'],
  ['август', 'авг'],
  ['сентябр', 'сен', 'сент'],
  ['октябр', 'окт'],
  ['ноябр', 'ноя', 'нояб'],
  ['декабр', 'дек'],
]
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function monthFromWord(w) {
  const s = w.replace(/\.$/, '')
  if (s.length < 3) return null
  for (let i = 0; i < MONTH_WORDS.length; i++) {
    for (const stem of MONTH_WORDS[i]) if (s.startsWith(stem)) return i + 1
  }
  const en = EN_MONTHS.indexOf(s.slice(0, 3))
  return en >= 0 ? en + 1 : null
}

/** Разбор одной даты без уточнений: «13.05.1991», «05.1991», «1991», «13 мая 1991», «май 1991», «1991-05-13». */
function parseSingle(s) {
  s = s.trim()
  if (!s) return null
  let m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  if (m) return build(+m[3] || null, +m[2], +m[1])
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{3,4})$/)
  if (m) return build(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[./](\d{3,4})$/)
  if (m) return build(null, +m[1], +m[2])
  m = s.match(/^(\d{1,2})[./](\d{1,2})$/)
  if (m) return build(+m[1], +m[2], null)
  m = s.match(/^(\d{3,4})$/)
  if (m) return build(null, null, +m[1])
  const words = s.split(/[\s,]+/).filter(Boolean)
  let day = null
  let month = null
  let year = null
  for (const w of words) {
    if (/^\d{3,4}$/.test(w) && !year) year = +w
    else if (/^\d{1,2}$/.test(w) && !day) day = +w
    else {
      const mo = monthFromWord(w)
      if (mo && !month) month = mo
      else return null
    }
  }
  if (!year && !month) return null
  return build(day, month, year)
}

function build(day, month, year) {
  if (month && (month < 1 || month > 12)) return null
  if (year !== null && (year < 1 || year > 2999)) return null
  if (day && !isValidDay(day, month, year)) return null
  return { day: day || null, month: month || null, year: year || null }
}

const W = String.raw`(?:\.\s*|\s+)`
const PREFIXES = [
  [new RegExp(String.raw`^(?:(?:около|ок|прибл|приблизительно|примерно|circa|ca|c|abt|about)${W}|~\s*)`), 'about'],
  [new RegExp(String.raw`^(?:предположительно|предп|вероятно|est)${W}`), 'estimated'],
  [new RegExp(String.raw`^(?:расч[её]тн\S*|расч|вычислено|cal)${W}`), 'calculated'],
  [new RegExp(String.raw`^(?:(?:не позже|не позднее|до|ранее|bef|before)${W}|<\s*)`), 'before'],
  [new RegExp(String.raw`^(?:(?:не ранее|после|позже|aft|after)${W}|>\s*)`), 'after'],
]

/**
 * Разбирает дату, введённую человеком. Возвращает GDate или null, если текст не похож на дату.
 * @param {string} text
 * @returns {import('./types').GDate | null}
 */
export function parseDateText(text) {
  let s = String(text ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return null
  let calendar
  const jul = /(?:^|\s)\(?\s*(?:по\s+)?(?:ст\.?\s*ст\.?|старому стилю|старого стиля|юл\.|julian)\s*\)?(?=$|\s)/
  if (jul.test(s)) {
    calendar = 'julian'
    s = s.replace(jul, ' ').trim()
  }
  s = s
    .replace(/(\d)\s*(?:гг?\.?|года?|году)(?=$|[\s\-)])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  let qualifier = 'exact'
  if (/\?$/.test(s)) {
    qualifier = 'estimated'
    s = s.slice(0, -1).trim()
  }
  for (const [re, q] of PREFIXES) {
    if (re.test(s)) {
      qualifier = q
      s = s.replace(re, '').trim()
      break
    }
  }

  // Десятилетие: «1880-е», «1880-х»
  const dec = s.match(/^(\d{3})0-?(?:е|х|ые|ых|s)$/)
  if (dec) {
    const y = +(dec[1] + '0')
    return clean({ qualifier: 'between', day: null, month: null, year: y, day2: null, month2: null, year2: y + 9, calendar })
  }

  // Интервал: «между A и B», «с A по B», «A-B», «A..B»
  let range = s.match(/^(?:между|с|from|bet\.?)\s+(.+?)\s+(?:и|по|and|to)\s+(.+)$/)
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
  if (!range && !iso) range = s.match(/^(.+?)\s*(?:-|\.\.)\s*(.+)$/)
  if (range) {
    const a = parseSingle(range[1])
    let b = parseSingle(range[2])
    // «1880-85» → 1885
    if (a?.year && !b && /^\d{2}$/.test(range[2].trim())) b = { day: null, month: null, year: Math.floor(a.year / 100) * 100 + +range[2] }
    if (a && b) return clean({ qualifier: 'between', ...a, day2: b.day, month2: b.month, year2: b.year, calendar })
    return null
  }

  const one = parseSingle(s)
  if (!one) return null
  return clean({ qualifier, ...one, calendar })
}

function clean(d) {
  const out = { ...d }
  if (!out.calendar) delete out.calendar
  return out
}

/** Текст для поля ввода: как пользователь бы это написал. */
export function dateToInput(d) {
  if (!d || !hasDate(d)) return ''
  if (!d.year && !d.month && !d.day) return d.text ?? ''
  const q = QUALIFIERS.find((x) => x.value === d.qualifier)
  const main = single(d.day, d.month, d.year, 'numeric')
  let s
  if (d.qualifier === 'between') s = `${main}-${single(d.day2, d.month2, d.year2, 'numeric')}`
  else s = (q?.prefix ?? '') + main
  if (d.calendar === 'julian') s += ' ст. ст.'
  return s
}

/** Совпадает ли день и месяц (годовщины). Для старого стиля сравнивается григорианский день. */
export function monthDay(d) {
  if (!d?.day || !d?.month || d.qualifier === 'between') return null
  const g = toGregorian(d)
  return { day: g.day, month: g.month }
}
