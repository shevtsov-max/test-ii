/**
 * Приведение данных к текущей версии модели (2).
 * Принимает древо версии 1 (старое приложение: места строками, фото внутри персоны, facts)
 * или версии 2 с пропущенными полями и возвращает полное нормализованное древо.
 */
import { emptyDate } from './dates'
import { emptyPoint, newClan, newFamily, newMedia, newPerson, newPlace, newSource, newTree, TREE_VERSION, uid } from './model'
import { ensurePlace } from './places'

const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {})
const arr = (x) => (Array.isArray(x) ? x : [])
const str = (x) => (typeof x === 'string' ? x : x == null ? '' : String(x))

function normDate(d) {
  const x = obj(d)
  const out = { ...emptyDate(), ...x }
  for (const k of ['day', 'month', 'year', 'day2', 'month2', 'year2']) {
    if (out[k] === undefined) continue
    const n = out[k] === null || out[k] === '' ? null : Number(out[k])
    out[k] = Number.isFinite(n) ? n : null
  }
  if (!out.qualifier) out.qualifier = 'exact'
  if (out.calendar !== 'julian') delete out.calendar
  return out
}

/**
 * Точка события: v1 { date, place: 'текст' } → v2 { date, placeId }.
 * @param {object} ctx — черновик древа (для реестра мест)
 */
function normPoint(ctx, x, extra = {}) {
  const src = obj(x)
  let placeId = src.placeId ?? null
  if (!placeId && src.place) placeId = ensurePlace(ctx, str(src.place))
  if (placeId && !ctx.places[placeId]) placeId = null
  return { ...emptyPoint(), date: normDate(src.date), placeId, citations: arr(src.citations).map(normCitation), ...extra }
}

const normCitation = (c) => ({
  id: c?.id ?? uid('c'),
  sourceId: str(c?.sourceId),
  page: str(c?.page),
  quality: [0, 1, 2, 3].includes(c?.quality) ? c.quality : 2,
  note: str(c?.note),
})

/**
 * @param {any} raw
 * @returns {import('./types').TreeData}
 */
export function migrateTree(raw) {
  const d = obj(raw)
  if (!d.persons || typeof d.persons !== 'object') throw new Error('Неверный формат файла: нет списка персон')

  const t = newTree({
    id: str(d.id) || uid('t'),
    name: str(d.name) || 'Семейное древо',
    description: str(d.description),
    createdAt: Number(d.createdAt) || Date.now(),
    updatedAt: Number(d.updatedAt) || Date.now(),
  })

  // Справочники v2 — переносим как есть (с нормализацией)
  for (const [id, p] of Object.entries(obj(d.places))) {
    t.places[id] = { ...newPlace(), ...obj(p), id, name: str(p?.name), parentId: p?.parentId ?? null }
  }
  for (const [id, p] of Object.entries(t.places)) if (p.parentId && (!t.places[p.parentId] || p.parentId === id)) p.parentId = null
  for (const [id, s] of Object.entries(obj(d.sources))) t.sources[id] = { ...newSource(), ...obj(s), id, date: normDate(s?.date) }
  for (const [id, c] of Object.entries(obj(d.clans))) t.clans[id] = { ...newClan(), ...obj(c), id }
  t.customFields = arr(d.customFields)
    .filter((f) => f && f.id && f.label)
    .map((f) => ({ id: str(f.id), label: str(f.label), type: ['text', 'number', 'date', 'url'].includes(f.type) ? f.type : 'text' }))
  for (const [id, m] of Object.entries(obj(d.media))) {
    t.media[id] = { ...newMedia(), ...obj(m), id, date: normDate(m?.date), personIds: arr(m?.personIds).map(str) }
  }

  for (const [id, raw] of Object.entries(d.persons)) {
    const p = obj(raw)
    const person = newPerson({
      id,
      gender: ['M', 'F', 'U'].includes(p.gender) ? p.gender : 'U',
      firstName: str(p.firstName),
      middleName: str(p.middleName),
      lastName: str(p.lastName),
      birthName: str(p.birthName),
      nickname: str(p.nickname),
      title: str(p.title),
      suffix: str(p.suffix),
      clanId: p.clanId && t.clans[p.clanId] ? p.clanId : null,
      living: p.living !== false,
      occupation: str(p.occupation),
      email: str(p.email),
      phone: str(p.phone),
      avatarId: p.avatarId ?? null,
      note: str(p.note),
      biography: str(p.biography),
      custom: Object.fromEntries(Object.entries(obj(p.custom)).map(([k, v]) => [k, str(v)])),
      citations: arr(p.citations).map(normCitation),
      favorite: !!p.favorite,
      privacy: ['public', 'family', 'private'].includes(p.privacy) ? p.privacy : 'public',
      createdAt: Number(p.createdAt) || Date.now(),
      updatedAt: Number(p.updatedAt) || Date.now(),
    })
    person.birth = normPoint(t, p.birth)
    person.death = normPoint(t, p.death, { cause: str(p.death?.cause) })
    person.residencePlaceId = p.residencePlaceId && t.places[p.residencePlaceId] ? p.residencePlaceId : null

    // v1: facts → events
    const events = arr(p.events).length ? arr(p.events) : arr(p.facts)
    person.events = events.map((e) => ({
      id: str(e?.id) || uid('e'),
      type: str(e?.type) || 'custom',
      title: str(e?.title),
      date: normDate(e?.date),
      placeId: e?.placeId && t.places[e.placeId] ? e.placeId : e?.place ? ensurePlace(t, str(e.place)) : null,
      description: str(e?.description),
      citations: arr(e?.citations).map(normCitation),
    }))

    // v1: фото внутри персоны → общие медиа древа
    for (const ph of arr(p.photos)) {
      if (!ph?.src) continue
      const mid = str(ph.id) || uid('m')
      if (t.media[mid]) {
        if (!t.media[mid].personIds.includes(id)) t.media[mid].personIds.push(id)
        continue
      }
      t.media[mid] = newMedia({
        id: mid,
        kind: 'photo',
        title: str(ph.caption),
        src: ph.src,
        thumb: ph.src,
        personIds: [id],
        createdAt: Number(ph.addedAt) || Date.now(),
      })
    }
    t.persons[id] = person
  }

  for (const [id, raw] of Object.entries(obj(d.families))) {
    const f = obj(raw)
    const partners = [...new Set(arr(f.partners).map(str))].filter((x) => t.persons[x]).slice(0, 2)
    const children = [...new Set(arr(f.children).map(str))].filter((x) => t.persons[x] && !partners.includes(x))
    if (!partners.length && !children.length) continue
    const links = {}
    for (const [c, l] of Object.entries(obj(f.childLinks))) if (children.includes(c) && l !== 'birth') links[c] = l
    t.families[id] = newFamily({
      id,
      partners,
      children,
      status: ['married', 'partners', 'engaged', 'divorced', 'separated', 'widowed', 'unknown'].includes(f.status) ? f.status : 'unknown',
      marriage: normPoint(t, f.marriage),
      divorce: normPoint(t, f.divorce),
      childLinks: links,
      note: str(f.note),
      citations: arr(f.citations).map(normCitation),
    })
  }

  // Ссылки на медиа и источники
  for (const m of Object.values(t.media)) m.personIds = m.personIds.filter((x) => t.persons[x])
  for (const p of Object.values(t.persons)) if (p.avatarId && !t.media[p.avatarId]) p.avatarId = null

  t.homePersonId = d.homePersonId && t.persons[d.homePersonId] ? d.homePersonId : (Object.keys(t.persons)[0] ?? null)
  t.version = TREE_VERSION
  return t
}

/** Похоже ли на данные древа (для импорта). */
export function looksLikeTree(raw) {
  return !!raw && typeof raw === 'object' && typeof raw.persons === 'object' && typeof raw.families === 'object'
}
