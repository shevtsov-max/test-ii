/**
 * Содержимое карточки персоны в схеме: строки текста с переносом и цвета.
 * Считается один раз на персону и набор настроек (кеш по объекту персоны).
 */
import { formatAge } from '@/domain/dates'
import { placeName } from '@/domain/places'
import { ageOf, mainOccupation } from '@/domain/person'
import { ellipsize, font, wrapText } from './text'
import { generationColor, genderColors } from './palette'

/** Геометрия карточки для плотности. */
export function cardGeom(M) {
  const { W, H, density } = M
  if (density === 'compact') {
    return { W, H, R: 12, av: 38, avX: 12, tx: 58, rel: { size: 10.5, y: 21 }, name: { size: 13, lines: 1, y: 38, lh: 15 }, years: { size: 11, y: 55 }, extra: [] }
  }
  if (density === 'detailed') {
    return {
      W,
      H,
      R: 14,
      av: 56,
      avX: 14,
      tx: 82,
      rel: { size: 11, y: 24 },
      name: { size: 14, lines: 2, y: 44, lh: 17 },
      years: { size: 12, y: 80 },
      extra: [
        { key: 'place', size: 11.5, y: 97 },
        { key: 'occ', size: 11.5, y: 112 },
      ],
    }
  }
  return { W, H, R: 14, av: 48, avX: 14, tx: 74, rel: { size: 11, y: 24 }, name: { size: 13.5, lines: 2, y: 44, lh: 17 }, years: { size: 12, y: 80 }, extra: [] }
}

/** «* 1868  † 1918 · 50 лет» */
function yearsLine(p) {
  const b = p.birth.date
  const d = p.death.date
  const yb = b.year ? (b.qualifier !== 'exact' ? '~' : '') + b.year : ''
  const yd = d.year ? (d.qualifier !== 'exact' ? '~' : '') + d.year : ''
  const age = formatAge(ageOf(p))
  if (p.living) return [yb && `р. ${yb}`, age].filter(Boolean).join(' · ')
  if (!yb && !yd) return 'годы жизни неизвестны'
  return [`${yb || '?'} – ${yd || '?'}`, age].filter(Boolean).join(' · ')
}

/**
 * @returns {{ rel: string, lines: string[], years: string, extra: Record<string, string>, accent: string, soft: string, gender: string[] }}
 */
export function cardModel(p, ctx) {
  const { tree, opts, M, P, relation, row } = ctx
  const g = cardGeom(M)
  const textW = g.W - g.tx - 16
  const nameFont = font(g.name.size, 600)
  const first = [p.firstName, opts.patronymic ? p.middleName : '', p.suffix].filter(Boolean).join(' ')
  const last = p.lastName || p.birthName
  let lines
  if (g.name.lines === 1) lines = [ellipsize([p.firstName, last].filter(Boolean).join(' ') || 'Без имени', nameFont, textW)]
  else if (!first && !last) lines = ['Без имени']
  else if (!last) lines = wrapText(first, nameFont, textW, 2)
  else if (!first) lines = wrapText(last, font(g.name.size, 700), textW, 2)
  else {
    const a = wrapText(first, nameFont, textW, 1)[0]
    lines = [a, ellipsize(last, font(g.name.size, 700), textW)]
  }
  const [gc, gs] = genderColors(P, p.gender)
  let accent = gc
  let soft = gs
  if (opts.colorBy === 'clan') {
    const c = p.clanId && tree.clans?.[p.clanId]?.color
    accent = c || P.unknown
    soft = c ? `${c}22` : P.unknownSoft
  } else if (opts.colorBy === 'generation' && row !== undefined) {
    accent = generationColor(row)
    soft = `${accent}22`
  } else if (opts.colorBy === 'living') {
    accent = p.living ? P.living : P.deceased
    soft = p.living ? `${P.living}22` : P.unknownSoft
  } else if (opts.colorBy === 'none') {
    accent = P.line
    soft = P.unknownSoft
  }
  const extra = {}
  if (g.extra.length) {
    const pl = placeName(tree, p.birth.placeId)
    extra.place = pl ? ellipsize(`⌂ ${pl}`, font(11.5, 500), textW) : ''
    const occ = mainOccupation(p)
    extra.occ = occ ? ellipsize(occ, font(11.5, 500), textW) : ''
  } else if (opts.places && g.W > 200) {
    const pl = placeName(tree, p.birth.placeId)
    if (pl) extra.inline = pl
  }
  const years = opts.years ? yearsLine(p) : ''
  const yearsText = ellipsize(extra.inline ? `${years}${years ? ' · ' : ''}${extra.inline}` : years, font(g.years.size, 500), textW)
  return {
    rel: relation ? ellipsize(relation, font(g.rel.size, 650), textW) : '',
    lines,
    years: yearsText,
    extra,
    accent,
    soft,
    gender: [gc, gs],
  }
}
