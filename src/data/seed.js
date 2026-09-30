import { emptyDate } from '@/domain/dates'
import { migrateTree } from '@/domain/migrate'
import { newClan, newFamily, newPerson, newTree } from '@/domain/model'
import { ensurePlacePath, findPlaceByName } from '@/domain/places'
import { patronymicFrom, surnameFor } from '@/domain/names'

/**
 * Компактная запись персоны для тестовых данных:
 * { id, g, f, m, l, t, s, bn, b: [год, месяц, день], bp, d, dp, occ, bio, ph: [[файл, подпись]] }
 */
function mk(p) {
  const [by, bm, bd] = Array.isArray(p.b) ? p.b : [p.b]
  const [dy, dm, dd] = Array.isArray(p.d) ? p.d : [p.d]
  const person = newPerson({
    id: p.id,
    gender: p.g,
    firstName: p.f,
    lastName: p.g === 'F' ? surnameFor(p.l ?? '', 'F') : p.l,
    middleName: p.m ?? '',
    living: !p.d,
    biography: p.bio ?? '',
    title: p.t ?? '',
    suffix: p.s ?? '',
    birthName: p.bn ?? '',
    occupation: p.occ ?? '',
    favorite: !!p.fav,
  })
  // Формат v1 (места строками, фото внутри персоны) — migrateTree приведёт к текущей модели
  person.birth = { date: { ...emptyDate(), year: by ?? null, month: bm ?? null, day: bd ?? null }, place: p.bp ?? '' }
  person.death = p.d
    ? { date: { ...emptyDate(), year: dy ?? null, month: dm ?? null, day: dd ?? null }, place: p.dp ?? '', cause: '' }
    : { date: emptyDate(), place: '', cause: '' }
  if (p.ph?.length) {
    person.photos = p.ph.map(([file, caption], i) => ({
      id: `${p.id}-ph${i}`,
      src: `${import.meta.env?.BASE_URL ?? './'}photos/${file}.svg`,
      caption,
      addedAt: 0,
    }))
    person.avatarId = person.photos[0].id
  }
  return person
}

export function fam(id, partners, children, status = 'married', year) {
  const f = newFamily({ id, partners, children, status })
  if (year) f.marriage = { date: { ...emptyDate(), year }, place: '' }
  return f
}

/**
 * @param {object} [extra]
 * @param {Record<string, string[]>} [extra.countries] страна → города (иерархия мест)
 * @param {{ name: string, color: string, surnames: string[] }[]} [extra.clans] роды по фамилиям
 */
export function build(id, name, home, persons, families, extra = {}) {
  const t = migrateTree({
    version: 1,
    id,
    name,
    homePersonId: home,
    persons: Object.fromEntries(persons.map((p) => [p.id, mk(p)])),
    families: Object.fromEntries(families.map((f) => [f.id, f])),
  })
  for (const [country, cities] of Object.entries(extra.countries ?? {})) {
    const c = { id: 'pl-' + country, name: country, type: 'country', parentId: null, lat: null, lng: null, altNames: '', note: '' }
    t.places[c.id] = c
    for (const city of cities) {
      const pl = findPlaceByName(t, city)
      if (pl) Object.assign(pl, { parentId: c.id, type: 'city' })
    }
  }
  for (const cl of extra.clans ?? []) {
    const clan = newClan({ id: 'cl-' + cl.name, name: cl.name, color: cl.color, description: cl.description ?? '' })
    t.clans[clan.id] = clan
    for (const p of Object.values(t.persons)) {
      const forms = [p.lastName, p.birthName, surnameFor(p.lastName, 'M'), surnameFor(p.birthName, 'M')]
      if (forms.some((x) => x && cl.surnames.includes(x))) p.clanId = clan.id
    }
  }
  return t
}

/** Древо пользователя из MyHeritage. */
export function shevtsovTree() {
  return build(
    'shevtsov',
    'Шевцовы',
    'max',
    [
      { id: 'max', g: 'M', f: 'Максим', m: 'Ильич', l: 'Шевцов', b: [1991, 5, 13], bp: 'Ставрополь', occ: 'Программист' },
      { id: 'ilya', g: 'M', f: 'Илья', m: 'Дмитриевич', l: 'Шевцов' },
      { id: 'valya', g: 'F', f: 'Валентина', m: 'Васильевна', l: 'Шевцова', bn: 'Ивашева', b: [1964, 4, 17] },
      { id: 'olya', g: 'F', f: 'Оля', l: 'Макаренко' },
    ],
    [fam('f-ilya-valya', ['ilya', 'valya'], ['max']), fam('f-ilya-olya', ['ilya', 'olya'], [], 'partners')],
    { countries: { Россия: ['Ставрополь'] } },
  )
}

/** Демо-древо — для проверки раскладки. */
export function demoTree() {
  const persons = [
    { id: 'gg1', g: 'M', f: 'Пётр', l: 'Орлов', m: 'Ильич', b: 1898, d: 1965, bp: 'Тверь', dp: 'Москва', occ: 'Кузнец' },
    { id: 'gg2', g: 'F', f: 'Анна', l: 'Орлова', m: 'Васильевна', b: 1902, d: 1979, bp: 'Тверь' },
    { id: 'gg3', g: 'M', f: 'Семён', l: 'Белов', b: 1900, d: 1943, dp: 'Сталинград', occ: 'Красноармеец' },
    { id: 'gg4', g: 'F', f: 'Мария', l: 'Белова', b: 1905, d: 1990 },
    { id: 'g1', g: 'M', f: 'Николай', l: 'Орлов', m: 'Петрович', b: [1928, 3, 14], d: 2004, bp: 'Москва', occ: 'Инженер' },
    { id: 'g2', g: 'F', f: 'Вера', l: 'Орлова', bn: 'Белова', m: 'Семёновна', b: [1931, 7, 2], d: 2015, bp: 'Рязань', occ: 'Учитель' },
    { id: 'g1s', g: 'F', f: 'Клавдия', l: 'Орлова', m: 'Петровна', b: 1925, d: 1999 },
    { id: 'g2b', g: 'M', f: 'Григорий', l: 'Белов', m: 'Семёнович', b: 1929, d: 2001 },
    { id: 'g3', g: 'M', f: 'Аркадий', l: 'Лебедев', b: 1930, d: 1998, bp: 'Казань' },
    { id: 'g4', g: 'F', f: 'Зоя', l: 'Лебедева', b: 1934, d: 2019 },
    { id: 'fa', g: 'M', f: 'Сергей', l: 'Орлов', m: 'Николаевич', b: [1956, 11, 20], bp: 'Москва', occ: 'Архитектор' },
    { id: 'mo', g: 'F', f: 'Ирина', l: 'Орлова', bn: 'Лебедева', m: 'Аркадьевна', b: [1959, 4, 8], bp: 'Казань' },
    { id: 'fa2', g: 'F', f: 'Людмила', l: 'Кравец', b: 1955 },
    { id: 'uncle', g: 'M', f: 'Виктор', l: 'Орлов', m: 'Николаевич', b: 1953 },
    { id: 'uncleW', g: 'F', f: 'Галина', l: 'Орлова', b: 1954 },
    { id: 'aunt', g: 'F', f: 'Ольга', l: 'Лебедева', m: 'Аркадьевна', b: 1962 },
    {
      id: 'me',
      g: 'M',
      f: 'Алексей',
      l: 'Орлов',
      m: 'Сергеевич',
      b: [1985, 6, 12],
      bp: 'Москва',
      occ: 'Разработчик',
      bio: 'Родился в Москве. Окончил МГТУ им. Баумана. Увлекается историей семьи.',
    },
    { id: 'wife', g: 'F', f: 'Екатерина', l: 'Орлова', b: [1988, 2, 3] },
    { id: 'sis', g: 'F', f: 'Дарья', l: 'Смирнова', bn: 'Орлова', m: 'Сергеевна', b: 1989 },
    { id: 'sisH', g: 'M', f: 'Павел', l: 'Смирнов', b: 1987 },
    { id: 'halfbro', g: 'M', f: 'Илья', l: 'Орлов', m: 'Сергеевич', b: 1979 },
    { id: 'cousin', g: 'M', f: 'Денис', l: 'Орлов', m: 'Викторович', b: 1980 },
    { id: 'son', g: 'M', f: 'Михаил', l: 'Орлов', m: 'Алексеевич', b: 2012 },
    { id: 'dau', g: 'F', f: 'София', l: 'Орлова', m: 'Алексеевна', b: 2015 },
    { id: 'niece', g: 'F', f: 'Алиса', l: 'Смирнова', m: 'Павловна', b: 2016 },
  ]
  const families = [
    fam('F-gg12', ['gg1', 'gg2'], ['g1s', 'g1'], 'married', 1923),
    fam('F-gg34', ['gg3', 'gg4'], ['g2', 'g2b'], 'married', 1927),
    fam('F-g12', ['g1', 'g2'], ['uncle', 'fa'], 'married', 1951),
    fam('F-g34', ['g3', 'g4'], ['mo', 'aunt'], 'married', 1956),
    fam('F-fa2', ['fa', 'fa2'], ['halfbro'], 'divorced', 1978),
    fam('F-parents', ['fa', 'mo'], ['me', 'sis'], 'married', 1983),
    fam('F-uncle', ['uncle', 'uncleW'], ['cousin'], 'married', 1978),
    fam('F-me', ['me', 'wife'], ['son', 'dau'], 'married', 2010),
    fam('F-sis', ['sisH', 'sis'], ['niece'], 'married', 2014),
  ]
  return build('demo', 'Демо: семья Орловых', 'me', persons, families, {
    countries: { Россия: ['Москва', 'Тверь', 'Рязань', 'Казань', 'Сталинград'] },
    clans: [
      { name: 'Орловы', color: '#C2410C', surnames: ['Орлов', 'Орлова'] },
      { name: 'Лебедевы', color: '#0F766E', surnames: ['Лебедев', 'Лебедева'] },
      { name: 'Беловы', color: '#7C3AED', surnames: ['Белов', 'Белова'] },
    ],
  })
}

/** Новое древо с одной персоной «Я». */
export function emptyTree(name = 'Моё семейное древо', me = {}) {
  const p = newPerson({ firstName: 'Я', gender: 'U', ...me })
  return newTree({ name, homePersonId: p.id, persons: { [p.id]: p } })
}

/**
 * Древо из мастера «Новое древо»: вы и (необязательно) родители.
 * Фамилии родителей и отчество подставляются, если не указаны.
 * @param {{ name?: string, me: object, birthPlace?: string, father?: { firstName: string }, mother?: { firstName: string, birthName?: string } }} p
 */
export function starterTree({ name, me, birthPlace = '', father, mother }) {
  const t = emptyTree(name, me)
  const self = t.persons[t.homePersonId]
  // «Россия, Ставрополь» — от общего к частному, как подсказано в форме
  if (birthPlace.trim()) self.birth = { ...self.birth, placeId: ensurePlacePath(t, birthPlace.split(',')) }
  const baseSurname = surnameFor(self.birthName || self.lastName, 'M')
  const parents = []
  if (father?.firstName?.trim()) {
    const f = newPerson({ gender: 'M', firstName: father.firstName.trim(), lastName: baseSurname, living: true })
    t.persons[f.id] = f
    parents.push(f.id)
    if (!self.middleName && self.gender !== 'U') self.middleName = patronymicFrom(f.firstName, self.gender)
  }
  if (mother?.firstName?.trim()) {
    const m = newPerson({
      gender: 'F',
      firstName: mother.firstName.trim(),
      lastName: surnameFor(baseSurname, 'F'),
      birthName: surnameFor(mother.birthName?.trim() ?? '', 'F'),
      living: true,
    })
    t.persons[m.id] = m
    parents.push(m.id)
  }
  if (parents.length) {
    const fam = newFamily({ partners: parents, children: [self.id] })
    t.families[fam.id] = fam
  }
  return t
}
