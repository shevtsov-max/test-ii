/**
 * Импорт / экспорт GEDCOM 5.5.1 — стандартный формат обмена родословными
 * (MyHeritage, Ancestry, FamilySearch, Gramps, «Древо Жизни» и др.).
 */
import { emptyDate } from './dates'
import { EVENT_TYPES, emptyPoint, newClan, newFamily, newMedia, newPerson, newSource, newTree, uid } from './model'
import { ensurePlacePath, placePath } from './places'

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

// ------------------------------------------------------------------ даты
function dmy(day, month, year) {
  return [day && month ? day : null, month ? MON[month - 1] : null, year].filter(Boolean).join(' ')
}

export function toGedDate(d) {
  if (!d || (!d.year && !d.month && !d.day)) return d?.text ? `(${d.text})` : ''
  const cal = d.calendar === 'julian' ? '@#DJULIAN@ ' : ''
  const main = cal + dmy(d.day, d.month, d.year)
  switch (d.qualifier) {
    case 'about':
      return `ABT ${main}`
    case 'estimated':
      return `EST ${main}`
    case 'calculated':
      return `CAL ${main}`
    case 'before':
      return `BEF ${main}`
    case 'after':
      return `AFT ${main}`
    case 'between': {
      const second = dmy(d.day2, d.month2, d.year2)
      return second ? `BET ${main} AND ${cal}${second}` : main
    }
    default:
      return main
  }
}

function parseSimple(s) {
  const tokens = s.trim().toUpperCase().split(/\s+/).filter(Boolean)
  let day = null
  let month = null
  let year = null
  for (const t of tokens) {
    const mi = MON.indexOf(t.slice(0, 3))
    if (mi >= 0 && /^[A-Z]+$/.test(t)) month = mi + 1
    else if (/^\d{3,4}(\/\d+)?$/.test(t)) year = parseInt(t, 10)
    else if (/^\d{1,2}$/.test(t)) day = parseInt(t, 10)
  }
  return { day, month, year }
}

export function fromGedDate(raw) {
  const d = emptyDate()
  if (!raw) return d
  let s = raw.trim().toUpperCase()
  if (/^\(.*\)$/.test(s)) return { ...d, text: raw.trim().slice(1, -1) }
  let calendar
  if (s.includes('@#DJULIAN@')) {
    calendar = 'julian'
    s = s.replace(/@#DJULIAN@/g, '')
  }
  s = s.replace(/@#D[A-Z ]+@/g, '').replace(/[()]/g, '').trim()
  const withCal = (x) => (calendar ? { ...x, calendar } : x)
  const m = s.match(/^(BET|FROM)\s+(.+?)\s+(AND|TO)\s+(.+)$/)
  if (m) {
    const a = parseSimple(m[2])
    const b = parseSimple(m[4])
    return withCal({ qualifier: 'between', ...a, day2: b.day, month2: b.month, year2: b.year })
  }
  const q = s.match(/^(ABT|ABOUT|CIR|CIRCA|CA|EST|CAL|BEF|BEFORE|AFT|AFTER|FROM|TO|INT)\.?\s+/)
  if (q) {
    s = s.slice(q[0].length)
    const k = q[1]
    d.qualifier = ['ABT', 'ABOUT', 'CIR', 'CIRCA', 'CA', 'INT'].includes(k)
      ? 'about'
      : k === 'EST'
        ? 'estimated'
        : k === 'CAL'
          ? 'calculated'
          : ['BEF', 'BEFORE', 'TO'].includes(k)
            ? 'before'
            : 'after'
  }
  const r = { ...d, ...parseSimple(s) }
  if (!r.year && !r.month && !r.day && raw.trim()) return { ...emptyDate(), text: raw.trim() }
  return withCal(r)
}

// ------------------------------------------------------------------ экспорт
const PEDI = { adopted: 'adopted', foster: 'foster', birth: 'birth', step: 'foster', guardian: 'foster' }

function textLines(level, tag, text) {
  const out = []
  text.split(/\r?\n/).forEach((line, i) => {
    const chunks = line.match(/.{1,200}/gu) ?? ['']
    chunks.forEach((c, j) => {
      if (i === 0 && j === 0) out.push(`${level} ${tag} ${c}`.trimEnd())
      else if (j === 0) out.push(`${level + 1} CONT ${c}`.trimEnd())
      else out.push(`${level + 1} CONC ${c}`)
    })
  })
  return out
}

/**
 * @param {import('./types').TreeData} t
 * @param {{ hideLiving?: boolean, excludePrivate?: boolean }} [opts]
 */
export function exportGedcom(t, opts = {}) {
  const persons = Object.values(t.persons).filter((p) => !(opts.excludePrivate && p.privacy === 'private'))
  const pset = new Set(persons.map((p) => p.id))
  const iid = new Map(persons.map((p, i) => [p.id, `@I${i + 1}@`]))
  const fams = Object.values(t.families).filter((f) => f.partners.some((x) => pset.has(x)) || f.children.some((x) => pset.has(x)))
  const fid = new Map(fams.map((f, i) => [f.id, `@F${i + 1}@`]))
  const sid = new Map(Object.keys(t.sources ?? {}).map((id, i) => [id, `@S${i + 1}@`]))
  const exportableMedia = Object.values(t.media ?? {}).filter((m) => m.src && !m.src.startsWith('data:'))
  const mid = new Map(exportableMedia.map((m, i) => [m.id, `@M${i + 1}@`]))

  const place = (id) =>
    placePath(t, id)
      .map((x) => x.name)
      .reverse()
      .join(', ')
  const cites = (level, list) => {
    const out = []
    for (const c of list ?? []) {
      if (!sid.has(c.sourceId)) continue
      out.push(`${level} SOUR ${sid.get(c.sourceId)}`)
      if (c.page) out.push(`${level + 1} PAGE ${c.page}`)
      out.push(`${level + 1} QUAY ${c.quality}`)
      if (c.note) out.push(...textLines(level + 1, 'NOTE', c.note))
    }
    return out
  }
  const eventLines = (level, tag, point, forceY = false, value = '') => {
    const d = toGedDate(point.date)
    const pl = place(point.placeId)
    if (!d && !pl && !value && !point.citations?.length) return forceY ? [`${level} ${tag} Y`] : []
    const out = [`${level} ${tag}${value ? ' ' + value : ''}`]
    if (d) out.push(`${level + 1} DATE ${d}`)
    if (pl) out.push(`${level + 1} PLAC ${pl}`)
    out.push(...cites(level + 1, point.citations))
    return out
  }

  const now = new Date()
  const L = [
    '0 HEAD',
    '1 SOUR RODOSLOVNAYA',
    '2 NAME Родословная',
    '2 VERS 2.0',
    `1 DATE ${now.getDate()} ${MON[now.getMonth()]} ${now.getFullYear()}`,
    '1 SUBM @U1@',
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    '1 LANG Russian',
    `1 _TREE ${t.name}`,
  ]
  if (t.homePersonId && iid.has(t.homePersonId)) L.push(`1 _HOME ${iid.get(t.homePersonId)}`)
  L.push('0 @U1@ SUBM', '1 NAME Родословная')

  for (const p of persons) {
    const hide = opts.hideLiving && p.living
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
    if (!hide) {
      L.push(...eventLines(1, 'BIRT', p.birth))
      if (!p.living) {
        L.push(...eventLines(1, 'DEAT', p.death, true))
        if (p.death.cause) L.push(`2 CAUS ${p.death.cause}`)
      }
      if (p.occupation) L.push(`1 OCCU ${p.occupation}`)
      if (p.residencePlaceId) L.push('1 RESI', `2 PLAC ${place(p.residencePlaceId)}`)
      for (const e of p.events) {
        const info = EVENT_TYPES.find((x) => x.value === e.type)
        const tag = info && !info.ged.startsWith('_') && info.ged !== 'EVEN' ? info.ged : 'EVEN'
        L.push(...eventLines(1, tag, e, true, e.description))
        if (tag === 'EVEN') L.push(`2 TYPE ${e.type === 'custom' ? e.title || 'Событие' : (info?.label ?? 'Событие')}`)
      }
      if (p.email) L.push(`1 EMAIL ${p.email}`)
      if (p.phone) L.push(`1 PHON ${p.phone}`)
      const note = [p.note, p.biography].filter(Boolean).join('\n\n')
      if (note) L.push(...textLines(1, 'NOTE', note))
      L.push(...cites(1, p.citations))
      for (const m of exportableMedia) if (m.personIds.includes(p.id)) L.push(`1 OBJE ${mid.get(m.id)}`)
      if (p.favorite) L.push('1 _FAV Y')
      if (p.clanId && t.clans?.[p.clanId]) L.push(`1 _CLAN ${t.clans[p.clanId].name}`)
    }
    for (const f of fams) {
      if (f.children.includes(p.id)) {
        L.push(`1 FAMC ${fid.get(f.id)}`)
        const link = f.childLinks?.[p.id]
        if (link && link !== 'birth' && PEDI[link]) L.push(`2 PEDI ${PEDI[link]}`)
      }
      if (f.partners.includes(p.id)) L.push(`1 FAMS ${fid.get(f.id)}`)
    }
  }

  for (const f of fams) {
    L.push(`0 ${fid.get(f.id)} FAM`)
    const sorted = f.partners.filter((x) => pset.has(x)).sort((a, b) => (t.persons[a]?.gender === 'F' ? 1 : t.persons[b]?.gender === 'F' ? -1 : 0))
    sorted.forEach((pid, i) => {
      const g = t.persons[pid]?.gender
      const tag = g === 'M' ? 'HUSB' : g === 'F' ? 'WIFE' : i === 0 ? 'HUSB' : 'WIFE'
      L.push(`1 ${tag} ${iid.get(pid)}`)
    })
    for (const c of f.children) if (pset.has(c)) L.push(`1 CHIL ${iid.get(c)}`)
    if (['married', 'divorced', 'widowed', 'separated'].includes(f.status) || f.marriage.date.year || f.marriage.placeId)
      L.push(...eventLines(1, 'MARR', f.marriage, f.status === 'married'))
    if (f.status === 'engaged') L.push(...eventLines(1, 'ENGA', f.marriage, true))
    if (f.status === 'divorced') L.push(...eventLines(1, 'DIV', f.divorce, true))
    L.push(`1 _STAT ${f.status}`)
    if (f.note) L.push(...textLines(1, 'NOTE', f.note))
    L.push(...cites(1, f.citations))
  }

  for (const s of Object.values(t.sources ?? {})) {
    L.push(`0 ${sid.get(s.id)} SOUR`)
    L.push(`1 TITL ${s.title || 'Источник'}`)
    if (s.author) L.push(`1 AUTH ${s.author}`)
    const publ = [s.repository, s.callNumber].filter(Boolean).join('; ')
    if (publ) L.push(`1 PUBL ${publ}`)
    if (s.url) L.push(`1 WWW ${s.url}`)
    if (s.note) L.push(...textLines(1, 'NOTE', s.note))
  }
  for (const m of exportableMedia) {
    L.push(`0 ${mid.get(m.id)} OBJE`)
    L.push(`1 FILE ${m.src}`)
    const form = (m.mime.split('/')[1] || m.src.split('.').pop() || '').toLowerCase()
    if (form) L.push(`2 FORM ${form}`)
    if (m.title) L.push(`2 TITL ${m.title}`)
  }
  L.push('0 TRLR')
  return L.join('\n') + '\n'
}

// ------------------------------------------------------------------ импорт
function parseLines(text) {
  const roots = []
  const stack = []
  for (const rawLine of text.replace(/^﻿/, '').split(/\r?\n|\r/)) {
    if (!rawLine.trim()) continue
    const m = rawLine.match(/^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?: (.*))?$/)
    if (!m) continue
    const node = { level: +m[1], xref: m[2], tag: m[3].toUpperCase(), value: m[4] ?? '', children: [] }
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

const child = (n, tag) => n.children.find((c) => c.tag === tag)
const childVal = (n, tag) => child(n, tag)?.value?.trim() ?? ''

const TAG_EVENT = {
  BAPM: 'baptism',
  CHR: 'baptism',
  EDUC: 'education',
  GRAD: 'education',
  OCCU: 'occupation',
  RESI: 'residence',
  EMIG: 'emigration',
  IMMI: 'immigration',
  CENS: 'census',
  BURI: 'burial',
  CREM: 'burial',
  RELI: 'religion',
  NATI: 'nationality',
  _MILT: 'military',
  _MILI: 'military',
  _MIL: 'military',
  _AWRD: 'award',
}

const PEDI_IN = { adopted: 'adopted', foster: 'foster', birth: 'birth', sealing: 'unknown' }

/**
 * @param {string} text содержимое .ged
 * @returns {import('./types').TreeData}
 */
export function importGedcom(text, name = 'Импортированное древо') {
  const roots = parseLines(text)
  const notes = new Map()
  for (const r of roots) if (r.tag === 'NOTE' && r.xref) notes.set(r.xref, r.value)
  const noteText = (n) => (n.value.startsWith('@') ? (notes.get(n.value.trim()) ?? '') : n.value)

  const t = newTree({ name })
  const idMap = new Map()
  const srcMap = new Map()
  const objMap = new Map()
  const clanByName = new Map()
  let homeRef

  const head = roots.find((r) => r.tag === 'HEAD')
  if (head) {
    homeRef = childVal(head, '_HOME') || undefined
    t.name = childVal(head, '_TREE') || childVal(head, 'FILE').replace(/\.ged$/i, '') || name
  }

  const placeOf = (n) => {
    const pl = childVal(n, 'PLAC')
    return pl ? ensurePlacePath(t, pl.split(',').reverse()) : null
  }
  const citesOf = (n) =>
    n.children
      .filter((c) => c.tag === 'SOUR' && srcMap.has(c.value.trim()))
      .map((c) => ({
        id: uid('c'),
        sourceId: srcMap.get(c.value.trim()),
        page: childVal(c, 'PAGE'),
        quality: [0, 1, 2, 3].includes(+childVal(c, 'QUAY')) && childVal(c, 'QUAY') !== '' ? +childVal(c, 'QUAY') : 2,
        note: childVal(c, 'NOTE'),
      }))
  const pointOf = (n) => ({ ...emptyPoint(), date: fromGedDate(childVal(n, 'DATE')), placeId: placeOf(n), citations: citesOf(n) })

  // Источники и медиа
  for (const r of roots) {
    if (r.tag === 'SOUR' && r.xref) {
      const s = newSource({
        title: childVal(r, 'TITL') || r.value || 'Источник',
        author: childVal(r, 'AUTH'),
        repository: childVal(r, 'PUBL'),
        url: childVal(r, 'WWW') || childVal(r, '_URL'),
        note: childVal(r, 'NOTE') || childVal(r, 'TEXT'),
        type: 'other',
      })
      t.sources[s.id] = s
      srcMap.set(r.xref, s.id)
    } else if (r.tag === 'OBJE' && r.xref) {
      const file = child(r, 'FILE')
      const url = file?.value.trim() ?? ''
      if (!/^https?:\/\//i.test(url)) continue
      const m = newMedia({ title: childVal(file, 'TITL') || childVal(r, 'TITL'), src: url, thumb: url, kind: 'photo' })
      t.media[m.id] = m
      objMap.set(r.xref, m.id)
    }
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
      if (c.tag === 'BIRT') p.birth = pointOf(c)
      else if (c.tag === 'DEAT') {
        p.living = false
        p.death = { ...pointOf(c), cause: childVal(c, 'CAUS') }
      } else if (c.tag === 'NOTE') {
        const tx = noteText(c).trim()
        if (tx) p.biography = p.biography ? `${p.biography}\n\n${tx}` : tx
      } else if (c.tag === 'EMAIL' || c.tag === '_EMAIL') p.email = c.value.trim()
      else if (c.tag === 'PHON') p.phone = c.value.trim()
      else if (c.tag === 'SOUR') p.citations.push(...citesOf({ children: [c] }))
      else if (c.tag === 'OBJE') {
        const id = objMap.get(c.value.trim())
        if (id) {
          t.media[id].personIds.push(p.id)
          if (!p.avatarId) p.avatarId = id
        }
      } else if (c.tag === '_FAV') p.favorite = true
      else if (c.tag === '_CLAN' && c.value.trim()) {
        const nm = c.value.trim()
        if (!clanByName.has(nm)) {
          const cl = newClan({ name: nm })
          t.clans[cl.id] = cl
          clanByName.set(nm, cl.id)
        }
        p.clanId = clanByName.get(nm)
      } else if (c.tag === 'OCCU' && !child(c, 'DATE') && !p.occupation && c.value.trim()) p.occupation = c.value.trim()
      else if (TAG_EVENT[c.tag] || c.tag === 'EVEN' || c.tag === 'FACT') {
        const type = TAG_EVENT[c.tag]
        const tType = childVal(c, 'TYPE')
        const pt = pointOf(c)
        p.events.push({
          id: uid('e'),
          type: type ?? (/milit|воен/i.test(tType) ? 'military' : /award|наград/i.test(tType) ? 'award' : 'custom'),
          title: type ? '' : tType,
          description: c.value.trim() === 'Y' ? '' : c.value.trim() || (c.tag === 'RESI' ? childVal(c, 'ADDR') : ''),
          date: pt.date,
          placeId: pt.placeId,
          citations: pt.citations,
        })
      }
    }
    t.persons[p.id] = p
  }

  const pediOf = new Map()
  for (const r of roots) {
    if (r.tag !== 'INDI' || !r.xref) continue
    for (const c of r.children) {
      if (c.tag !== 'FAMC') continue
      const pedi = childVal(c, 'PEDI').toLowerCase()
      if (pedi && PEDI_IN[pedi] && PEDI_IN[pedi] !== 'birth') pediOf.set(`${c.value.trim()}|${idMap.get(r.xref)}`, PEDI_IN[pedi])
    }
  }

  for (const r of roots) {
    if (r.tag !== 'FAM' || !r.xref) continue
    const f = newFamily()
    for (const c of r.children) {
      const pid = idMap.get(c.value.trim())
      if ((c.tag === 'HUSB' || c.tag === 'WIFE') && pid && !f.partners.includes(pid) && f.partners.length < 2) f.partners.push(pid)
      else if (c.tag === 'CHIL' && pid && !f.children.includes(pid)) {
        f.children.push(pid)
        const link = pediOf.get(`${r.xref}|${pid}`)
        if (link) f.childLinks[pid] = link
        const frel = (childVal(c, '_FREL') || childVal(c, '_MREL')).toLowerCase()
        if (!link && /adopt/.test(frel)) f.childLinks[pid] = 'adopted'
        else if (!link && /foster/.test(frel)) f.childLinks[pid] = 'foster'
      }
    }
    const marr = child(r, 'MARR')
    const div = child(r, 'DIV')
    const enga = child(r, 'ENGA')
    const stat = childVal(r, '_STAT').toLowerCase()
    if (marr) f.marriage = pointOf(marr)
    else if (enga) f.marriage = pointOf(enga)
    if (div) f.divorce = pointOf(div)
    const note = child(r, 'NOTE')
    if (note) f.note = noteText(note)
    f.citations = citesOf(r)
    const known = ['married', 'partners', 'engaged', 'divorced', 'separated', 'widowed', 'unknown']
    f.status = known.includes(stat)
      ? stat
      : div || /divorc/.test(stat)
        ? 'divorced'
        : /separ/.test(stat)
          ? 'separated'
          : /partner|friend/.test(stat)
            ? 'partners'
            : enga && !marr
              ? 'engaged'
              : f.partners.length === 2
                ? 'married'
                : 'unknown'
    if (f.partners.length + f.children.length > 0) t.families[f.id] = f
  }

  if (!Object.keys(t.persons).length) throw new Error('В файле не найдено ни одной персоны (INDI)')
  t.homePersonId = (homeRef && idMap.get(homeRef)) || Object.keys(t.persons)[0]
  return t
}
