/**
 * Импорт / экспорт GEDCOM 5.5.1 — стандартный формат обмена родословными
 * (MyHeritage, Ancestry, FamilySearch, Gramps и др.).
 */
import type { Fact, FactType, Family, FamilyStatus, GDate, Person, TreeData } from '@/types'
import { emptyDate, emptyEvent, newFamily, newPerson, uid } from './person'

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

// ------------------------------------------------------------------ dates
function dmy(day?: number | null, month?: number | null, year?: number | null) {
  return [day && month ? day : null, month ? MON[month - 1] : null, year].filter(Boolean).join(' ')
}

export function toGedDate(d: GDate): string {
  if (!d.year && !d.month && !d.day) return ''
  const main = dmy(d.day, d.month, d.year)
  switch (d.qualifier) {
    case 'about':
      return `ABT ${main}`
    case 'estimated':
      return `EST ${main}`
    case 'before':
      return `BEF ${main}`
    case 'after':
      return `AFT ${main}`
    case 'between': {
      const second = dmy(d.day2, d.month2, d.year2)
      return second ? `BET ${main} AND ${second}` : main
    }
    default:
      return main
  }
}

function parseSimple(s: string): { day: number | null; month: number | null; year: number | null } {
  const tokens = s.trim().toUpperCase().split(/\s+/).filter(Boolean)
  let day: number | null = null
  let month: number | null = null
  let year: number | null = null
  for (const t of tokens) {
    const mi = MON.indexOf(t.slice(0, 3))
    if (mi >= 0 && /^[A-Z]+$/.test(t)) month = mi + 1
    else if (/^\d{3,4}(\/\d+)?$/.test(t)) year = parseInt(t, 10)
    else if (/^\d{1,2}$/.test(t)) day = parseInt(t, 10)
  }
  return { day, month, year }
}

export function fromGedDate(raw: string | undefined): GDate {
  const d = emptyDate()
  if (!raw) return d
  let s = raw.trim().toUpperCase().replace(/[()]/g, '')
  const m = s.match(/^(BET|FROM)\s+(.+?)\s+(AND|TO)\s+(.+)$/)
  if (m) {
    const a = parseSimple(m[2])
    const b = parseSimple(m[4])
    return { qualifier: 'between', ...a, day2: b.day, month2: b.month, year2: b.year }
  }
  const q = s.match(/^(ABT|ABOUT|CIR|CIRCA|CA|EST|CAL|BEF|BEFORE|AFT|AFTER|FROM|TO|INT)\.?\s+/)
  if (q) {
    s = s.slice(q[0].length)
    const k = q[1]
    d.qualifier = ['ABT', 'ABOUT', 'CIR', 'CIRCA', 'CA', 'INT'].includes(k)
      ? 'about'
      : ['EST', 'CAL'].includes(k)
        ? 'estimated'
        : ['BEF', 'BEFORE', 'TO'].includes(k)
          ? 'before'
          : 'after'
  }
  return { ...d, ...parseSimple(s) }
}

// ------------------------------------------------------------------ export
const FACT_TAG: Partial<Record<FactType, string>> = {
  baptism: 'BAPM',
  education: 'EDUC',
  occupation: 'OCCU',
  residence: 'RESI',
  emigration: 'EMIG',
  immigration: 'IMMI',
  burial: 'BURI',
  religion: 'RELI',
  nationality: 'NATI',
}

function textLines(level: number, tag: string, text: string): string[] {
  const out: string[] = []
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    const chunks = line.match(/.{1,200}/gu) ?? ['']
    chunks.forEach((c, j) => {
      if (i === 0 && j === 0) out.push(`${level} ${tag} ${c}`.trimEnd())
      else if (j === 0) out.push(`${level + 1} CONT ${c}`.trimEnd())
      else out.push(`${level + 1} CONC ${c}`)
    })
  })
  return out
}

function eventLines(level: number, tag: string, date: GDate, place: string, forceY = false): string[] {
  const d = toGedDate(date)
  if (!d && !place) return forceY ? [`${level} ${tag} Y`] : []
  const out = [`${level} ${tag}`]
  if (d) out.push(`${level + 1} DATE ${d}`)
  if (place) out.push(`${level + 1} PLAC ${place}`)
  return out
}

export function exportGedcom(t: TreeData): string {
  const iid = new Map<string, string>()
  const fid = new Map<string, string>()
  Object.keys(t.persons).forEach((id, i) => iid.set(id, `@I${i + 1}@`))
  Object.keys(t.families).forEach((id, i) => fid.set(id, `@F${i + 1}@`))
  const now = new Date()
  const L: string[] = [
    '0 HEAD',
    '1 SOUR RODOSLOVNAYA',
    '2 NAME Родословная (Vue 3 + Quasar)',
    '2 VERS 1.0',
    `1 DATE ${now.getDate()} ${MON[now.getMonth()]} ${now.getFullYear()}`,
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    '1 LANG Russian',
    `1 _TREE ${t.name}`,
  ]
  if (t.homePersonId && iid.has(t.homePersonId)) L.push(`1 _HOME ${iid.get(t.homePersonId)}`)

  for (const p of Object.values(t.persons)) {
    L.push(`0 ${iid.get(p.id)} INDI`)
    const given = [p.firstName, p.middleName].filter(Boolean).join(' ')
    L.push(`1 NAME ${given} /${p.lastName}/`.replace(/\s+/g, ' ').trim())
    if (given) L.push(`2 GIVN ${given}`)
    if (p.lastName) L.push(`2 SURN ${p.lastName}`)
    if (p.title) L.push(`2 NPFX ${p.title}`)
    if (p.suffix) L.push(`2 NSFX ${p.suffix}`)
    if (p.nickname) L.push(`2 NICK ${p.nickname}`)
    if (p.birthName && p.birthName !== p.lastName) {
      L.push(`1 NAME ${given} /${p.birthName}/`.replace(/\s+/g, ' ').trim())
      L.push('2 TYPE birth')
    }
    L.push(`1 SEX ${p.gender}`)
    L.push(...eventLines(1, 'BIRT', p.birth.date, p.birth.place))
    if (!p.living) {
      L.push(...eventLines(1, 'DEAT', p.death.date, p.death.place, true))
      if (p.death.cause) L.push(`2 CAUS ${p.death.cause}`)
    }
    for (const f of p.facts) {
      const tag = FACT_TAG[f.type]
      if (tag) {
        L.push(`1 ${tag}${f.description ? ' ' + f.description : ''}`)
      } else {
        L.push(`1 EVEN${f.description ? ' ' + f.description : ''}`)
        L.push(`2 TYPE ${f.type === 'military' ? 'Военная служба' : f.type === 'award' ? 'Награда' : f.title || 'Событие'}`)
      }
      const d = toGedDate(f.date)
      if (d) L.push(`2 DATE ${d}`)
      if (f.place) L.push(`2 PLAC ${f.place}`)
    }
    if (p.email) L.push(`1 EMAIL ${p.email}`)
    if (p.phone) L.push(`1 PHON ${p.phone}`)
    if (p.biography) L.push(...textLines(1, 'NOTE', p.biography))
    for (const f of Object.values(t.families)) {
      if (f.children.includes(p.id)) L.push(`1 FAMC ${fid.get(f.id)}`)
      if (f.partners.includes(p.id)) L.push(`1 FAMS ${fid.get(f.id)}`)
    }
  }

  for (const f of Object.values(t.families)) {
    L.push(`0 ${fid.get(f.id)} FAM`)
    const sorted = [...f.partners].sort((a, b) =>
      t.persons[a]?.gender === 'F' ? 1 : t.persons[b]?.gender === 'F' ? -1 : 0,
    )
    sorted.forEach((pid, i) => {
      const g = t.persons[pid]?.gender
      const tag = g === 'M' ? 'HUSB' : g === 'F' ? 'WIFE' : i === 0 ? 'HUSB' : 'WIFE'
      L.push(`1 ${tag} ${iid.get(pid)}`)
    })
    for (const c of f.children) L.push(`1 CHIL ${iid.get(c)}`)
    if (f.status === 'married' || f.status === 'divorced' || f.status === 'widowed' || f.marriage.date.year || f.marriage.place)
      L.push(...eventLines(1, 'MARR', f.marriage.date, f.marriage.place, f.status === 'married'))
    if (f.status === 'divorced') L.push(...eventLines(1, 'DIV', f.divorce.date, f.divorce.place, true))
    L.push(`1 _STAT ${f.status}`)
  }
  L.push('0 TRLR')
  return L.join('\n') + '\n'
}

// ------------------------------------------------------------------ import
interface Node {
  level: number
  xref?: string
  tag: string
  value: string
  children: Node[]
}

function parseLines(text: string): Node[] {
  const roots: Node[] = []
  const stack: Node[] = []
  for (const rawLine of text.replace(/^﻿/, '').split(/\r?\n|\r/)) {
    if (!rawLine.trim()) continue
    const m = rawLine.match(/^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?: (.*))?$/)
    if (!m) continue
    const node: Node = { level: +m[1], xref: m[2], tag: m[3].toUpperCase(), value: m[4] ?? '', children: [] }
    if (node.tag === 'CONT' || node.tag === 'CONC') {
      const parent = stack[node.level - 1]
      if (parent) parent.value += (node.tag === 'CONT' ? '\n' : '') + node.value
      continue
    }
    while (stack.length > node.level) stack.pop()
    if (node.level === 0) roots.push(node)
    else stack[node.level - 1]?.children.push(node)
    stack[node.level] = node
    stack.length = node.level + 1
  }
  return roots
}

const child = (n: Node, tag: string) => n.children.find((c) => c.tag === tag)
const childVal = (n: Node, tag: string) => child(n, tag)?.value?.trim() ?? ''

const TAG_FACT: Record<string, FactType> = {
  BAPM: 'baptism',
  CHR: 'baptism',
  EDUC: 'education',
  OCCU: 'occupation',
  RESI: 'residence',
  EMIG: 'emigration',
  IMMI: 'immigration',
  BURI: 'burial',
  RELI: 'religion',
  NATI: 'nationality',
  _MILT: 'military',
  _MILI: 'military',
}

export function importGedcom(text: string, name = 'Импортированное древо'): TreeData {
  const roots = parseLines(text)
  const notes = new Map<string, string>()
  for (const r of roots) if (r.tag === 'NOTE' && r.xref) notes.set(r.xref, r.value)
  const noteText = (n: Node) => (n.value.startsWith('@') ? (notes.get(n.value.trim()) ?? '') : n.value)

  const persons: Record<string, Person> = {}
  const families: Record<string, Family> = {}
  const idMap = new Map<string, string>()
  let homeRef: string | undefined
  let treeName = name

  const head = roots.find((r) => r.tag === 'HEAD')
  if (head) {
    homeRef = childVal(head, '_HOME') || undefined
    treeName = childVal(head, '_TREE') || childVal(head, 'FILE')?.replace(/\.ged$/i, '') || name
  }

  for (const r of roots) {
    if (r.tag !== 'INDI' || !r.xref) continue
    const p = newPerson()
    idMap.set(r.xref, p.id)
    const names = r.children.filter((c) => c.tag === 'NAME')
    const main = names.find((n) => !/birth|maiden/i.test(childVal(n, 'TYPE'))) ?? names[0]
    if (main) {
      const m = main.value.match(/^(.*?)\/(.*?)\/(.*)$/)
      const givenRaw = childVal(main, 'GIVN') || (m ? m[1] : main.value).trim()
      const [first, ...rest] = givenRaw.split(/\s+/).filter(Boolean)
      p.firstName = first ?? ''
      p.middleName = rest.join(' ')
      p.lastName = childVal(main, 'SURN') || (m ? m[2].trim() : '')
      p.title = childVal(main, 'NPFX')
      p.suffix = childVal(main, 'NSFX') || (m ? m[3].trim() : '')
      p.nickname = childVal(main, 'NICK')
      const marn = childVal(main, '_MARNM')
      if (marn) {
        p.birthName = p.lastName
        p.lastName = marn
      }
    }
    const birthNameNode = names.find((n) => n !== main && /birth|maiden/i.test(childVal(n, 'TYPE')))
    if (birthNameNode) {
      const m = birthNameNode.value.match(/\/(.*?)\//)
      if (m) p.birthName = m[1].trim()
    }
    const sex = childVal(r, 'SEX').toUpperCase()
    p.gender = sex === 'M' ? 'M' : sex === 'F' ? 'F' : 'U'

    for (const c of r.children) {
      if (c.tag === 'BIRT') p.birth = { date: fromGedDate(childVal(c, 'DATE')), place: childVal(c, 'PLAC') }
      else if (c.tag === 'DEAT') {
        p.living = false
        p.death = { date: fromGedDate(childVal(c, 'DATE')), place: childVal(c, 'PLAC'), cause: childVal(c, 'CAUS') }
      } else if (c.tag === 'NOTE') {
        const t = noteText(c).trim()
        if (t) p.biography = p.biography ? `${p.biography}\n\n${t}` : t
      } else if (c.tag === 'EMAIL' || c.tag === '_EMAIL') p.email = c.value.trim()
      else if (c.tag === 'PHON') p.phone = c.value.trim()
      else if (TAG_FACT[c.tag] || c.tag === 'EVEN' || c.tag === 'FACT') {
        const type = TAG_FACT[c.tag]
        const tType = childVal(c, 'TYPE')
        const fact: Fact = {
          id: uid('fa'),
          type: type ?? (/milit|воен/i.test(tType) ? 'military' : /award|наград/i.test(tType) ? 'award' : 'custom'),
          title: type ? '' : tType,
          description: c.value.trim() || (c.tag === 'RESI' ? childVal(c, 'ADDR') : ''),
          date: fromGedDate(childVal(c, 'DATE')),
          place: childVal(c, 'PLAC'),
        }
        p.facts.push(fact)
      }
    }
    persons[p.id] = p
  }

  for (const r of roots) {
    if (r.tag !== 'FAM' || !r.xref) continue
    const f = newFamily()
    for (const c of r.children) {
      const pid = idMap.get(c.value.trim())
      if ((c.tag === 'HUSB' || c.tag === 'WIFE') && pid && !f.partners.includes(pid)) f.partners.push(pid)
      else if (c.tag === 'CHIL' && pid && !f.children.includes(pid)) f.children.push(pid)
    }
    const marr = child(r, 'MARR')
    const div = child(r, 'DIV')
    const stat = childVal(r, '_STAT').toLowerCase()
    if (marr) f.marriage = { date: fromGedDate(childVal(marr, 'DATE')), place: childVal(marr, 'PLAC') }
    if (div) f.divorce = { date: fromGedDate(childVal(div, 'DATE')), place: childVal(div, 'PLAC') }
    else f.divorce = emptyEvent()
    const known: FamilyStatus[] = ['married', 'partners', 'engaged', 'divorced', 'separated', 'widowed', 'unknown']
    f.status = known.includes(stat as FamilyStatus)
      ? (stat as FamilyStatus)
      : div || /divorc/.test(stat)
        ? 'divorced'
        : /separ/.test(stat)
          ? 'separated'
          : /partner|friend/.test(stat)
            ? 'partners'
            : /engag/.test(stat)
              ? 'engaged'
              : f.partners.length === 2
                ? 'married'
                : 'unknown'
    if (f.partners.length + f.children.length > 0) families[f.id] = f
  }

  if (!Object.keys(persons).length) throw new Error('В файле не найдено ни одной персоны (INDI)')
  const home = (homeRef && idMap.get(homeRef)) || Object.keys(persons)[0]
  return { version: 1, id: uid('tree'), name: treeName, homePersonId: home, persons, families }
}

/** Проверка и нормализация JSON-резервной копии. */
export function validateTreeJson(raw: unknown): TreeData {
  const d = raw as TreeData
  if (!d || typeof d !== 'object' || !d.persons || !d.families) throw new Error('Неверный формат файла')
  const persons: Record<string, Person> = {}
  for (const [id, p] of Object.entries(d.persons)) {
    persons[id] = { ...newPerson(), ...p, id, birth: { ...emptyEvent(), ...p.birth }, death: { ...emptyEvent(), ...p.death, cause: p.death?.cause ?? '' } }
  }
  const families: Record<string, Family> = {}
  for (const [id, f] of Object.entries(d.families)) {
    families[id] = {
      ...newFamily(),
      ...f,
      id,
      partners: (f.partners ?? []).filter((x) => persons[x]),
      children: (f.children ?? []).filter((x) => persons[x]),
    }
  }
  return {
    version: 1,
    id: d.id ?? uid('tree'),
    name: d.name ?? 'Семейное древо',
    homePersonId: d.homePersonId && persons[d.homePersonId] ? d.homePersonId : Object.keys(persons)[0] ?? null,
    persons,
    families,
  }
}
