/**
 * Росписи — текстовые родословные отчёты:
 *  • нисходящая поколенная роспись (потомки родоначальника по коленам, со сквозной нумерацией);
 *  • восходящая роспись (предки с нумерацией Соса — Страдоница: отец = 2n, мать = 2n + 1).
 */
import { formatDate } from './dates'
import { statusInfo } from './model'
import { formalName } from './names'
import { mainOccupation } from './person'
import { placeName } from './places'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX']
export const roman = (n) => ROMAN[n - 1] ?? String(n)

/** «р. 13 мая 1991, Ставрополь; ум. 1918, Екатеринбург; программист» */
export function vitalLine(tree, p, opts = {}) {
  const { places = true, occupation = true, hideLiving = false } = opts
  if (hideLiving && p.living) return 'жив(а)'
  const parts = []
  const b = [formatDate(p.birth.date), places ? placeName(tree, p.birth.placeId) : ''].filter(Boolean).join(', ')
  if (b) parts.push(`р. ${b}`)
  if (!p.living) {
    const d = [formatDate(p.death.date), places ? placeName(tree, p.death.placeId) : ''].filter(Boolean).join(', ')
    parts.push(d ? `ум. ${d}` : 'умер(ла)')
  }
  if (occupation) {
    const occ = mainOccupation(p)
    if (occ) parts.push(occ)
  }
  return parts.join('; ')
}

/**
 * Нисходящая поколенная роспись.
 * @param {import('./graph').FamilyGraph} G
 * @param {string} rootId родоначальник
 * @param {{ generations?: number, maleLine?: boolean, spouses?: boolean, places?: boolean, notes?: boolean, hideLiving?: boolean }} opts
 */
export function descendantReport(G, rootId, opts = {}) {
  const { generations = 10, maleLine = false, spouses = true, notes = false } = opts
  const t = G.tree
  const root = G.person(rootId)
  if (!root) return null
  const num = new Map()
  const gens = []
  let counter = 0
  let level = [{ id: rootId, parent: null }]
  for (let gi = 1; gi <= generations && level.length; gi++) {
    const entries = []
    const next = []
    for (const { id, parent } of level) {
      if (num.has(id)) continue
      num.set(id, ++counter)
      entries.push({ id, parent })
    }
    for (const e of entries) {
      const p = G.person(e.id)
      if (maleLine && p.gender === 'F' && e.id !== rootId) continue
      for (const c of G.children(e.id)) if (!num.has(c)) next.push({ id: c, parent: e.id })
    }
    gens.push({ index: gi, label: `Колено ${roman(gi)}`, entries })
    level = next
  }
  // Второй проход — ссылки на номера детей и описание супругов
  for (const g of gens) {
    g.entries = g.entries.map((e) => {
      const p = G.person(e.id)
      const fams = G.spouseFamilies(e.id)
      return {
        num: num.get(e.id),
        personId: e.id,
        name: formalName(p),
        parentNum: e.parent ? num.get(e.parent) : null,
        parentName: e.parent ? formalName(G.person(e.parent)) : '',
        info: vitalLine(t, p, opts),
        note: notes ? p.note || '' : '',
        stopped: maleLine && p.gender === 'F' && e.id !== rootId,
        families: fams.map((f) => {
          const other = G.partnerIn(f, e.id)
          const op = G.person(other)
          const kids = G.familyChildren(f)
          return {
            familyId: f.id,
            status: statusInfo(f.status).label,
            partnerId: other ?? null,
            partnerName: spouses && op ? formalName(op) : '',
            partnerInfo: spouses && op ? vitalLine(t, op, opts) : '',
            marriage: formatDate(f.marriage.date),
            children: kids.map((c) => ({ id: c, num: num.get(c) ?? null, name: formalName(G.person(c)) })),
          }
        }),
      }
    })
  }
  return { kind: 'descendants', title: `Поколенная роспись потомков: ${formalName(root)}`, rootId, generations: gens, total: counter }
}

/**
 * Восходящая роспись (аненталь).
 * @param {import('./graph').FamilyGraph} G
 */
export function ancestorReport(G, rootId, opts = {}) {
  const { generations = 8 } = opts
  const t = G.tree
  const root = G.person(rootId)
  if (!root) return null
  const firstNum = new Map()
  const gens = []
  let level = [{ id: rootId, n: 1 }]
  for (let gi = 1; gi <= generations && level.length; gi++) {
    const entries = []
    const next = []
    for (const { id, n } of level) {
      const p = G.person(id)
      const seen = firstNum.get(id)
      entries.push({
        num: n,
        personId: id,
        name: formalName(p),
        info: seen ? '' : vitalLine(t, p, opts),
        repeatOf: seen ?? null,
        note: !seen && opts.notes ? p.note || '' : '',
      })
      if (seen) continue
      firstNum.set(id, n)
      const { father, mother } = G.parents(id)
      if (father) next.push({ id: father, n: n * 2 })
      if (mother) next.push({ id: mother, n: n * 2 + 1 })
    }
    gens.push({ index: gi, label: ancestorGenLabel(gi), entries })
    level = next
  }
  return { kind: 'ancestors', title: `Восходящая роспись: ${formalName(root)}`, rootId, generations: gens, total: firstNum.size }
}

export function ancestorGenLabel(gi) {
  const names = ['Родоначальник росписи', 'Родители', 'Деды и бабушки', 'Прадеды и прабабушки']
  if (gi <= names.length) return `Поколение ${roman(gi)} — ${names[gi - 1]}`
  return `Поколение ${roman(gi)} — ${'пра'.repeat(gi - 3)}деды`
}

/** Плоский текст росписи — для копирования и файла .txt */
export function reportToText(report) {
  if (!report) return ''
  const L = [report.title, '='.repeat(Math.min(80, report.title.length)), '']
  for (const g of report.generations) {
    L.push(g.label.toUpperCase(), '')
    for (const e of g.entries) {
      if (report.kind === 'ancestors') {
        L.push(`${e.num}. ${e.name}${e.repeatOf ? ` — см. № ${e.repeatOf}` : ''}`)
        if (e.info) L.push(`    ${e.info}`)
        if (e.note) L.push(`    ${e.note}`)
        continue
      }
      L.push(`${e.num}. ${e.name}${e.parentNum ? ` (от № ${e.parentNum})` : ''}`)
      if (e.info) L.push(`    ${e.info}`)
      if (e.note) L.push(`    ${e.note}`)
      for (const f of e.families) {
        if (f.partnerName) L.push(`    ${f.status}${f.marriage ? ` (${f.marriage})` : ''}: ${f.partnerName}${f.partnerInfo ? ` — ${f.partnerInfo}` : ''}`)
        if (f.children.length && !e.stopped)
          L.push(`    Дети: ${f.children.map((c) => (c.num ? `${c.name.split(' ').slice(1, 2).join('')} (№ ${c.num})` : c.name)).join(', ')}`)
      }
    }
    L.push('')
  }
  return L.join('\n')
}
