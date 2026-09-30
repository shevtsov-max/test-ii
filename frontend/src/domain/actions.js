/**
 * Изменения древа — функции над immer-черновиком (draft). Не зависят от Vue и хранилища,
 * поэтому легко тестируются. Стор вызывает их внутри `commit()`.
 */
import { newFamily, newPerson } from './model'
import { mergePersonsRecipe } from './validation'

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

// ------------------------------------------------------------------ поиск в черновике
export const parentFamiliesIn = (d, pid) => Object.values(d.families).filter((f) => f.children.includes(pid))
export function primaryParentFamily(d, pid) {
  const list = parentFamiliesIn(d, pid)
  return list.find((f) => (f.childLinks?.[pid] ?? 'birth') === 'birth') ?? list[0]
}
export const spouseFamiliesIn = (d, pid) => Object.values(d.families).filter((f) => f.partners.includes(pid))

/** Является ли a предком b (по любым связям). */
export function isAncestorIn(d, a, b) {
  const seen = new Set([b])
  const q = [b]
  while (q.length) {
    const cur = q.shift()
    for (const f of parentFamiliesIn(d, cur)) {
      for (const p of f.partners) {
        if (p === a) return true
        if (!seen.has(p)) {
          seen.add(p)
          q.push(p)
        }
      }
    }
  }
  return false
}

/** Удаляет пустые семьи и ссылки на удалённых людей. */
export function cleanupFamilies(d) {
  for (const f of Object.values(d.families)) {
    f.partners = f.partners.filter((p) => d.persons[p])
    f.children = f.children.filter((c) => d.persons[c] && !f.partners.includes(c))
    for (const c of Object.keys(f.childLinks ?? {})) if (!f.children.includes(c)) delete f.childLinks[c]
    const n = f.partners.length
    const c = f.children.length
    if ((n === 0 && c <= 1) || (n === 1 && c === 0)) delete d.families[f.id]
  }
}

const touch = (p) => {
  if (p) p.updatedAt = Date.now()
}

// ------------------------------------------------------------------ персоны
export function addPerson(d, data) {
  const p = newPerson(clone(data))
  d.persons[p.id] = p
  if (!d.homePersonId) d.homePersonId = p.id
  return p.id
}

/** Частичное обновление: поля верхнего уровня заменяются копиями. */
export function updatePerson(d, id, patch) {
  const p = d.persons[id]
  if (!p) return
  for (const [k, v] of Object.entries(patch)) if (k !== 'id') p[k] = clone(v)
  touch(p)
}

export function deletePerson(d, id) {
  if (!d.persons[id]) return null
  const neighbours = []
  for (const f of Object.values(d.families)) {
    if (f.partners.includes(id)) neighbours.push(...f.children, ...f.partners)
    if (f.children.includes(id)) neighbours.push(...f.partners, ...f.children)
  }
  delete d.persons[id]
  for (const f of Object.values(d.families)) {
    f.partners = f.partners.filter((p) => p !== id)
    f.children = f.children.filter((c) => c !== id)
  }
  for (const m of Object.values(d.media ?? {})) if (m.personIds.includes(id)) m.personIds = m.personIds.filter((x) => x !== id)
  cleanupFamilies(d)
  const fallback = neighbours.find((n) => n !== id && d.persons[n]) ?? Object.keys(d.persons)[0] ?? null
  if (d.homePersonId === id) d.homePersonId = fallback
  return fallback
}

/**
 * Добавить родственника (нового или существующего) к персоне.
 * @param {'father' | 'mother' | 'brother' | 'sister' | 'partner' | 'son' | 'daughter'} kind
 * @param {{ existingId?: string, familyId?: string, status?: string, link?: string }} opts
 * @returns {string} id добавленной/связанной персоны
 */
export function addRelative(d, targetId, kind, data, opts = {}) {
  if (!d.persons[targetId]) throw new Error('Персона не найдена')
  let pid
  if (opts.existingId) {
    if (!d.persons[opts.existingId]) throw new Error('Персона не найдена')
    if (opts.existingId === targetId) throw new Error('Нельзя связать персону саму с собой')
    pid = opts.existingId
    if ((kind === 'father' || kind === 'mother') && isAncestorIn(d, targetId, pid))
      throw new Error('Нельзя: выбранная персона — потомок, она не может быть родителем')
    if ((kind === 'son' || kind === 'daughter') && isAncestorIn(d, pid, targetId))
      throw new Error('Нельзя: выбранная персона — предок, она не может быть ребёнком')
  } else {
    const gender = ['father', 'brother', 'son'].includes(kind) ? 'M' : ['mother', 'sister', 'daughter'].includes(kind) ? 'F' : (data.gender ?? 'U')
    const p = newPerson({ ...clone(data), gender: data.gender ?? gender })
    d.persons[p.id] = p
    pid = p.id
  }
  const addFamily = (f) => (d.families[f.id] = f)
  const setLink = (f, child) => {
    if (opts.link && opts.link !== 'birth') {
      f.childLinks ??= {}
      f.childLinks[child] = opts.link
    }
  }

  switch (kind) {
    case 'father':
    case 'mother': {
      let pf = opts.familyId && d.families[opts.familyId]?.children.includes(targetId) ? d.families[opts.familyId] : null
      // Приёмные родители — отдельная семья-родители с типом связи
      if (!pf && opts.link && opts.link !== 'birth') {
        pf = addFamily(newFamily({ partners: [], children: [targetId], status: 'unknown' }))
        setLink(pf, targetId)
      }
      pf ??= primaryParentFamily(d, targetId)
      if (!pf) {
        pf = addFamily(newFamily({ partners: [], children: [targetId], status: 'unknown' }))
        setLink(pf, targetId)
      }
      if (pf.partners.length >= 2) throw new Error('У персоны уже есть оба родителя')
      if (pf.partners.includes(pid)) break
      // Выбранный родитель уже в паре с известным родителем — переносим ребёнка в их семью
      const existingPartner = pf.partners[0]
      if (existingPartner && opts.existingId) {
        const both = Object.values(d.families).find((f) => f.id !== pf.id && f.partners.includes(existingPartner) && f.partners.includes(pid))
        if (both) {
          pf.children = pf.children.filter((c) => c !== targetId)
          both.children.push(targetId)
          if (pf.childLinks?.[targetId]) {
            both.childLinks ??= {}
            both.childLinks[targetId] = pf.childLinks[targetId]
          }
          cleanupFamilies(d)
          break
        }
      }
      pf.partners.push(pid)
      if (pf.partners.length === 2 && pf.status === 'unknown') pf.status = 'married'
      break
    }
    case 'son':
    case 'daughter': {
      if (opts.existingId && primaryParentFamily(d, pid)) {
        const pf = primaryParentFamily(d, pid)
        if (pf.partners.length >= 2) throw new Error('У выбранной персоны уже есть оба родителя')
        if (!pf.partners.includes(targetId)) pf.partners.push(targetId)
        break
      }
      let fam
      if (opts.familyId && d.families[opts.familyId]) fam = d.families[opts.familyId]
      else {
        fam = Object.values(d.families).find((f) => f.partners.length === 1 && f.partners[0] === targetId)
        if (!fam) fam = addFamily(newFamily({ partners: [targetId], status: 'unknown' }))
      }
      if (!fam.children.includes(pid)) fam.children.push(pid)
      setLink(fam, pid)
      break
    }
    case 'brother':
    case 'sister': {
      if (opts.existingId && primaryParentFamily(d, pid)) throw new Error('У выбранной персоны уже есть родители — добавьте её через родителей')
      let fam
      if (opts.familyId && d.families[opts.familyId]) fam = d.families[opts.familyId]
      else fam = primaryParentFamily(d, targetId)
      if (!fam) fam = addFamily(newFamily({ partners: [], children: [targetId], status: 'unknown' }))
      if (!fam.children.includes(pid)) fam.children.push(pid)
      setLink(fam, pid)
      break
    }
    case 'partner': {
      const exists = Object.values(d.families).find((f) => f.partners.includes(targetId) && f.partners.includes(pid))
      if (exists) throw new Error('Эти персоны уже связаны как партнёры')
      // Есть «семья с одним родителем» с детьми — второй родитель этих детей
      let fam
      if (opts.familyId && d.families[opts.familyId]?.partners.length === 1) {
        fam = d.families[opts.familyId]
        fam.partners.push(pid)
        fam.status = opts.status ?? 'married'
      } else fam = addFamily(newFamily({ partners: [targetId, pid], status: opts.status ?? 'married' }))
      if (opts.marriage) fam.marriage = { ...fam.marriage, ...clone(opts.marriage) }
      break
    }
    default:
      throw new Error('Неизвестный тип родства')
  }
  return pid
}

/** Новая (приёмная) семья-родители для персоны: потом в неё добавляются родители. */
export function addParentFamily(d, childId, link = 'adopted') {
  const f = newFamily({ partners: [], children: [childId], status: 'unknown', childLinks: link === 'birth' ? {} : { [childId]: link } })
  d.families[f.id] = f
  return f.id
}

// ------------------------------------------------------------------ семьи
export function updateFamily(d, id, patch) {
  const f = d.families[id]
  if (!f) return
  for (const [k, v] of Object.entries(patch)) if (k !== 'id') f[k] = clone(v)
}

/** Разорвать связь партнёров (дети остаются с keepId). */
export function removePartnership(d, familyId, keepId) {
  const f = d.families[familyId]
  if (!f) return
  if (!f.children.length) delete d.families[familyId]
  else f.partners = f.partners.filter((p) => p === keepId)
  cleanupFamilies(d)
}

/** Отвязать ребёнка от родителей (от конкретной семьи или от основной). */
export function detachChild(d, childId, familyId) {
  const f = familyId ? d.families[familyId] : primaryParentFamily(d, childId)
  if (!f) return
  f.children = f.children.filter((c) => c !== childId)
  if (f.childLinks) delete f.childLinks[childId]
  cleanupFamilies(d)
}

export function setChildLink(d, familyId, childId, link) {
  const f = d.families[familyId]
  if (!f || !f.children.includes(childId)) return
  f.childLinks ??= {}
  if (link === 'birth') delete f.childLinks[childId]
  else f.childLinks[childId] = link
}

/** Переместить ребёнка в другую семью родителей (например, к другой матери). */
export function moveChild(d, childId, fromFamilyId, toFamilyId) {
  const from = d.families[fromFamilyId]
  const to = d.families[toFamilyId]
  if (!from || !to || from === to) return
  from.children = from.children.filter((c) => c !== childId)
  if (!to.children.includes(childId)) to.children.push(childId)
  if (from.childLinks?.[childId]) {
    to.childLinks ??= {}
    to.childLinks[childId] = from.childLinks[childId]
    delete from.childLinks[childId]
  }
  cleanupFamilies(d)
}

// ------------------------------------------------------------------ события
export function saveEvent(d, pid, ev) {
  const p = d.persons[pid]
  if (!p) return
  const copy = clone(ev)
  const i = p.events.findIndex((e) => e.id === ev.id)
  if (i >= 0) p.events[i] = copy
  else p.events.push(copy)
  touch(p)
}

export function removeEvent(d, pid, eventId) {
  const p = d.persons[pid]
  if (!p) return
  p.events = p.events.filter((e) => e.id !== eventId)
  touch(p)
}

// ------------------------------------------------------------------ места
export function savePlace(d, place) {
  if (place.parentId === place.id) place = { ...place, parentId: null }
  d.places[place.id] = clone(place)
}

/** Заменить место во всех ссылках (удаление с переносом, объединение). */
export function replacePlaceRefs(d, fromId, toId) {
  const r = (x) => (x === fromId ? (toId ?? null) : x)
  for (const p of Object.values(d.persons)) {
    if (p.birth.placeId === fromId) p.birth.placeId = r(p.birth.placeId)
    if (p.death.placeId === fromId) p.death.placeId = r(p.death.placeId)
    if (p.residencePlaceId === fromId) p.residencePlaceId = r(p.residencePlaceId)
    for (const e of p.events) if (e.placeId === fromId) e.placeId = r(e.placeId)
  }
  for (const f of Object.values(d.families)) {
    if (f.marriage.placeId === fromId) f.marriage.placeId = r(f.marriage.placeId)
    if (f.divorce?.placeId === fromId) f.divorce.placeId = r(f.divorce.placeId)
  }
  for (const m of Object.values(d.media)) if (m.placeId === fromId) m.placeId = r(m.placeId)
  for (const pl of Object.values(d.places)) if (pl.parentId === fromId) pl.parentId = toId && toId !== pl.id ? toId : null
}

export function removePlace(d, id, replaceWith = null) {
  replacePlaceRefs(d, id, replaceWith)
  delete d.places[id]
}

export function mergePlaces(d, keepId, dropId) {
  if (keepId === dropId) return
  const keep = d.places[keepId]
  const drop = d.places[dropId]
  if (!keep || !drop) return
  if (keep.lat == null && drop.lat != null) {
    keep.lat = drop.lat
    keep.lng = drop.lng
  }
  keep.altNames = [keep.altNames, drop.name !== keep.name ? drop.name : '', drop.altNames].filter(Boolean).join(', ')
  if (!keep.note) keep.note = drop.note
  removePlace(d, dropId, keepId)
}

// ------------------------------------------------------------------ медиа
export function addMedia(d, items) {
  for (const m of items) d.media[m.id] = clone(m)
  // Первое фото становится главным у людей без фото
  for (const m of items) {
    if (m.kind !== 'photo') continue
    for (const pid of m.personIds) if (d.persons[pid] && !d.persons[pid].avatarId && m.personIds.length === 1) d.persons[pid].avatarId = m.id
  }
}

export function updateMedia(d, id, patch) {
  const m = d.media[id]
  if (!m) return
  for (const [k, v] of Object.entries(patch)) if (k !== 'id') m[k] = clone(v)
  for (const p of Object.values(d.persons)) if (p.avatarId === id && !m.personIds.includes(p.id)) p.avatarId = null
}

export function removeMedia(d, id) {
  delete d.media[id]
  for (const p of Object.values(d.persons)) if (p.avatarId === id) p.avatarId = null
}

export function setAvatar(d, pid, mediaId) {
  const p = d.persons[pid]
  const m = mediaId ? d.media[mediaId] : null
  if (!p) return
  if (m && !m.personIds.includes(pid)) m.personIds.push(pid)
  p.avatarId = mediaId
  touch(p)
}

export function linkMedia(d, mediaId, pid, on = true) {
  const m = d.media[mediaId]
  if (!m) return
  if (on && !m.personIds.includes(pid)) m.personIds.push(pid)
  if (!on) {
    m.personIds = m.personIds.filter((x) => x !== pid)
    if (d.persons[pid]?.avatarId === mediaId) d.persons[pid].avatarId = null
  }
}

// ------------------------------------------------------------------ источники
export function saveSource(d, source) {
  d.sources[source.id] = clone(source)
}

export function removeSource(d, id) {
  delete d.sources[id]
  const strip = (list) => (list ?? []).filter((c) => c.sourceId !== id)
  for (const p of Object.values(d.persons)) {
    p.citations = strip(p.citations)
    p.birth.citations = strip(p.birth.citations)
    p.death.citations = strip(p.death.citations)
    for (const e of p.events) e.citations = strip(e.citations)
  }
  for (const f of Object.values(d.families)) {
    f.citations = strip(f.citations)
    f.marriage.citations = strip(f.marriage.citations)
  }
  for (const m of Object.values(d.media)) if (m.sourceId === id) m.sourceId = null
}

// ------------------------------------------------------------------ роды
export function saveClan(d, clan) {
  d.clans[clan.id] = clone(clan)
}
export function removeClan(d, id) {
  delete d.clans[id]
  for (const p of Object.values(d.persons)) if (p.clanId === id) p.clanId = null
}
export function assignClan(d, personIds, clanId) {
  for (const id of personIds) if (d.persons[id]) d.persons[id].clanId = clanId
}

// ------------------------------------------------------------------ дополнительные поля
export function saveCustomField(d, def) {
  const i = d.customFields.findIndex((f) => f.id === def.id)
  if (i >= 0) d.customFields[i] = clone(def)
  else d.customFields.push(clone(def))
}
export function removeCustomField(d, id) {
  d.customFields = d.customFields.filter((f) => f.id !== id)
  for (const p of Object.values(d.persons)) if (p.custom?.[id] !== undefined) delete p.custom[id]
}

// ------------------------------------------------------------------ прочее
export function mergePersons(d, keepId, dropId) {
  mergePersonsRecipe(d, keepId, dropId)
  cleanupFamilies(d)
}
