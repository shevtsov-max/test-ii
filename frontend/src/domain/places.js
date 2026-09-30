/**
 * Места: иерархия (страна → регион → район → город/село), полное название, поиск и создание по тексту.
 */
import { newPlace } from './model'

/** Цепочка от самого общего к самому частному: [Россия, Санкт-Петербург]. */
export function placePath(tree, id) {
  const out = []
  const seen = new Set()
  let cur = id ? tree.places?.[id] : null
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    out.unshift(cur)
    cur = cur.parentId ? tree.places[cur.parentId] : null
  }
  return out
}

/** «Россия, Санкт-Петербург» (от общего к частному, как в адресе). */
export function placeFullName(tree, id) {
  return placePath(tree, id)
    .map((p) => p.name)
    .filter(Boolean)
    .join(', ')
}

export function placeName(tree, id) {
  return (id && tree.places?.[id]?.name) || ''
}

/** Потомки места (для фильтра «родились в Ставропольском крае»). */
export function placeDescendants(tree, id) {
  const out = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const p of Object.values(tree.places)) {
      if (p.parentId && out.has(p.parentId) && !out.has(p.id)) {
        out.add(p.id)
        grew = true
      }
    }
  }
  return out
}

const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()

export function findPlaceByName(tree, name, parentId) {
  const n = norm(name)
  return Object.values(tree.places ?? {}).find(
    (p) => norm(p.name) === n && (parentId === undefined || (p.parentId ?? null) === (parentId ?? null)),
  )
}

/**
 * Найти или создать место по введённому тексту (внутри immer-черновика древа).
 * «Россия, Санкт-Петербург»: если первая часть уже есть в справочнике — создаётся вложенная иерархия;
 * иначе — одно место с полным текстом.
 * @returns {string | null} id места
 */
export function ensurePlace(draft, text) {
  const s = (text ?? '').trim()
  if (!s) return null
  draft.places ??= {}
  const exact = findPlaceByName(draft, s)
  if (exact) return exact.id
  const parts = s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  if (parts.length > 1) {
    const matchByPath = (list) => {
      let parent = null
      for (const [i, name] of list.entries()) {
        const found = findPlaceByName(draft, name, i === 0 ? undefined : parent)
        if (found) parent = found.id
        else if (i === 0) return null
        else {
          const p = newPlace({ name, parentId: parent })
          draft.places[p.id] = p
          parent = p.id
        }
      }
      return parent
    }
    const general = matchByPath(parts)
    if (general) return general
    const specific = matchByPath([...parts].reverse())
    if (specific) return specific
  }
  const p = newPlace({ name: s })
  draft.places[p.id] = p
  return p.id
}

/** Где используется место: число событий и людей. */
export function placeUsage(tree) {
  const map = new Map()
  const bump = (id, key, personId) => {
    if (!id) return
    let u = map.get(id)
    if (!u) map.set(id, (u = { births: 0, deaths: 0, residence: 0, events: 0, marriages: 0, media: 0, total: 0, persons: new Set() }))
    u[key]++
    u.total++
    if (personId) u.persons.add(personId)
  }
  for (const p of Object.values(tree.persons)) {
    bump(p.birth.placeId, 'births', p.id)
    if (!p.living) bump(p.death.placeId, 'deaths', p.id)
    bump(p.residencePlaceId, 'residence', p.id)
    for (const e of p.events) bump(e.placeId, 'events', p.id)
  }
  for (const f of Object.values(tree.families)) {
    bump(f.marriage.placeId, 'marriages', f.partners[0])
    if (f.partners[1]) map.get(f.marriage.placeId)?.persons.add(f.partners[1])
    bump(f.divorce?.placeId, 'marriages')
  }
  for (const m of Object.values(tree.media ?? {})) bump(m.placeId, 'media')
  return map
}

/** Ссылка на карту (OpenStreetMap) по координатам или названию. */
export function placeMapUrl(tree, id) {
  const p = tree.places?.[id]
  if (!p) return ''
  if (p.lat != null && p.lng != null) return `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=12/${p.lat}/${p.lng}`
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(placeFullName(tree, id))}`
}

/**
 * Найти или создать цепочку мест по частям от общего к частному: ['Россия', 'Санкт-Петербург'].
 * @returns {string | null} id самого частного места
 */
export function ensurePlacePath(draft, partsGeneralFirst) {
  draft.places ??= {}
  let parent = null
  for (const name of partsGeneralFirst.map((x) => x.trim()).filter(Boolean)) {
    const found = findPlaceByName(draft, name, parent)
    if (found) parent = found.id
    else {
      const p = newPlace({ name, parentId: parent })
      draft.places[p.id] = p
      parent = p.id
    }
  }
  return parent
}
