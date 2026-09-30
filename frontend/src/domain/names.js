/**
 * Русские имена: род фамилии, отчества по имени отца, варианты отображения ФИО.
 */

/** Приводит фамилию к нужному роду: Шевцов ↔ Шевцова, Бельский ↔ Бельская. */
export function surnameFor(surname, g) {
  const s = (surname ?? '').trim()
  if (!s || g === 'U') return s
  if (g === 'F') {
    if (/(ов|ев|ёв|ин|ын)$/i.test(s)) return s + 'а'
    if (/(ой|ый|ий)$/i.test(s)) return s.slice(0, -2) + 'ая'
    return s
  }
  if (/(ов|ев|ёв|ин|ын)а$/i.test(s)) return s.slice(0, -1)
  if (/(ск|цк)ая$/i.test(s)) return s.slice(0, -2) + 'ий'
  return s
}

const SPECIAL = {
  илья: ['Ильич', 'Ильинична'],
  пётр: ['Петрович', 'Петровна'],
  петр: ['Петрович', 'Петровна'],
  павел: ['Павлович', 'Павловна'],
  лев: ['Львович', 'Львовна'],
  кузьма: ['Кузьмич', 'Кузьминична'],
  фома: ['Фомич', 'Фоминична'],
  лука: ['Лукич', 'Лукинична'],
  никита: ['Никитич', 'Никитична'],
  яков: ['Яковлевич', 'Яковлевна'],
  михаил: ['Михайлович', 'Михайловна'],
  гавриил: ['Гаврилович', 'Гавриловна'],
  даниил: ['Данилович', 'Даниловна'],
}

/** Отчество по имени отца. */
export function patronymicFrom(fatherName, g) {
  const n = (fatherName ?? '').trim()
  if (!n || g === 'U') return ''
  const fem = g === 'F'
  const sp = SPECIAL[n.toLowerCase()]
  if (sp) return fem ? sp[1] : sp[0]
  if (/й$/i.test(n)) {
    const base = n.slice(0, -1)
    // Василий → Васильевич, Андрей → Андреевич, Николай → Николаевич
    if (/и$/i.test(base)) return base.slice(0, -1) + 'ь' + (fem ? 'евна' : 'евич')
    return base + (fem ? 'евна' : 'евич')
  }
  if (/ь$/i.test(n)) return n.slice(0, -1) + (fem ? 'евна' : 'евич')
  if (/[ая]$/i.test(n)) return n.slice(0, -1) + (fem ? 'ична' : 'ич')
  if (/[жшчщц]$/i.test(n)) return n + (fem ? 'евна' : 'евич')
  return n + (fem ? 'овна' : 'ович')
}

/** Сестра Сергеевича — Сергеевна. */
export function patronymicSwap(patr, g) {
  const p = (patr ?? '').trim()
  if (!p || g === 'U') return p
  if (g === 'F') {
    if (/ильич$/i.test(p)) return p.replace(/ич$/i, 'инична')
    if (/(кузьм|фом|лук)ич$/i.test(p)) return p.replace(/ич$/i, 'инична')
    if (/вич$/i.test(p)) return p.replace(/вич$/i, 'вна')
    if (/ич$/i.test(p)) return p.replace(/ич$/i, 'ична')
    return p
  }
  if (/инична$/i.test(p)) return p.replace(/инична$/i, 'ич')
  if (/вна$/i.test(p)) return p.replace(/вна$/i, 'вич')
  if (/ична$/i.test(p)) return p.replace(/ична$/i, 'ич')
  return p
}

// ------------------------------------------------------------------ отображение
const NONAME = 'Без имени'

/** «Николай Александрович Романов» (+ титул и суффикс, если нужно). */
export function fullName(p, opts = {}) {
  if (!p) return ''
  const { middle = true, title = false } = opts
  // «Николай II Александрович» — римская цифра сразу после имени, «старший/младший» — в конце
  const roman = title && /^[IVXLC]+$/.test(p.suffix ?? '')
  const name = [title ? p.title : '', p.firstName, roman ? p.suffix : '', middle ? p.middleName : '', p.lastName, title && !roman ? p.suffix : '']
    .filter(Boolean)
    .join(' ')
    .trim()
  return name || NONAME
}

/** «Николай Романов» */
export function shortName(p) {
  if (!p) return ''
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || NONAME
}

/**
 * «Шевцова (Ивашева) Валентина Васильевна» — фамилия впереди, девичья в скобках.
 * Так люди записаны в списках и росписях.
 */
export function formalName(p, opts = {}) {
  if (!p) return ''
  const { maiden = true } = opts
  const last = p.lastName
    ? p.lastName + (maiden && p.birthName && p.birthName !== p.lastName ? ` (${p.birthName})` : '')
    : maiden && p.birthName
      ? `(${p.birthName})`
      : ''
  return [last, p.firstName, p.middleName].filter(Boolean).join(' ') || NONAME
}

/** Ключ сортировки «фамилия имя отчество». */
export function sortName(p) {
  return `${p.lastName || p.birthName || '￿'} ${p.firstName} ${p.middleName}`.toLowerCase().replace(/ё/g, 'е')
}

export function initials(p) {
  if (!p) return '?'
  const a = (p.firstName || '').trim()[0] || ''
  const b = (p.lastName || '').trim()[0] || ''
  return (a + b).toUpperCase() || '?'
}

/** «Н. А. Романов» */
export function initialsName(p) {
  if (!p) return ''
  const f = p.firstName ? p.firstName[0] + '.' : ''
  const m = p.middleName ? p.middleName[0] + '.' : ''
  return [f, m, p.lastName].filter(Boolean).join(' ') || NONAME
}

/** Имя отца по отчеству: «Николаевич» → «Николай», «Ильинична» → «Илья». Пустая строка — если не удалось. */
export function fatherNameFromPatronymic(patr) {
  const p = (patr ?? '').trim()
  if (!p) return ''
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
  if (/^ильи(ч|нична)$/i.test(p)) return 'Илья'
  let m = p.match(/^(.+?)(ович|овна)$/i)
  if (m) return cap(m[1])
  m = p.match(/^(.+?)(евич|евна)$/i)
  if (m) {
    const b = m[1]
    if (/ь$/i.test(b)) return cap(b.slice(0, -1) + 'ий')
    if (/[аеёиоуыэюя]$/i.test(b)) return cap(b + 'й')
    return cap(b + 'ь')
  }
  m = p.match(/^(.+?)(инична|ична|ич)$/i)
  if (m) return cap(m[1] + 'а')
  return ''
}
