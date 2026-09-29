import type { Gender } from '@/types'

/** Приводит русскую фамилию к нужному роду: Шевцов ↔ Шевцова, Бельский ↔ Бельская. */
export function surnameFor(surname: string, g: Gender): string {
  const s = surname.trim()
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

const SPECIAL: Record<string, [string, string]> = {
  илья: ['Ильич', 'Ильинична'],
  пётр: ['Петрович', 'Петровна'],
  петр: ['Петрович', 'Петровна'],
  павел: ['Павлович', 'Павловна'],
  лев: ['Львович', 'Львовна'],
  кузьма: ['Кузьмич', 'Кузьминична'],
  фома: ['Фомич', 'Фоминична'],
  никита: ['Никитич', 'Никитична'],
  яков: ['Яковлевич', 'Яковлевна'],
}

/** Отчество по имени отца. */
export function patronymicFrom(fatherName: string, g: Gender): string {
  const n = fatherName.trim()
  if (!n || g === 'U') return ''
  const fem = g === 'F'
  const sp = SPECIAL[n.toLowerCase()]
  if (sp) return fem ? sp[1] : sp[0]
  if (/[ий]$/i.test(n) && /й$/i.test(n)) {
    const base = n.slice(0, -1)
    // Василий → Васильевич, Андрей → Андреевич
    if (/и$/i.test(base)) return base.slice(0, -1) + 'ь' + (fem ? 'евна' : 'евич')
    return base + (fem ? 'евна' : 'евич')
  }
  if (/ь$/i.test(n)) return n.slice(0, -1) + (fem ? 'евна' : 'евич')
  if (/[ая]$/i.test(n)) return n.slice(0, -1) + (fem ? 'ична' : 'ич')
  if (/[жшчщц]$/i.test(n)) return n + (fem ? 'евна' : 'евич')
  return n + (fem ? 'овна' : 'ович')
}

/** Сестра Сергеевича — Сергеевна. */
export function patronymicSwap(patr: string, g: Gender): string {
  const p = patr.trim()
  if (!p || g === 'U') return p
  if (g === 'F') {
    if (/ильич$/i.test(p)) return p.replace(/ич$/i, 'инична')
    if (/вич$/i.test(p)) return p.replace(/вич$/i, 'вна')
    if (/ич$/i.test(p)) return p.replace(/ич$/i, 'ична')
    return p
  }
  if (/инична$/i.test(p)) return p.replace(/инична$/i, 'ич')
  if (/вна$/i.test(p)) return p.replace(/вна$/i, 'вич')
  if (/ична$/i.test(p)) return p.replace(/ична$/i, 'ич')
  return p
}
