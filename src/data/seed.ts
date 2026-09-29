import type { Family, FamilyStatus, Gender, Person, TreeData } from '@/types'
import { emptyDate, newFamily, newPerson } from '@/utils/person'

export interface P {
  id: string
  g: Gender
  f: string
  l: string
  m?: string
  b?: number | [number, number?, number?]
  bp?: string
  d?: number | [number, number?, number?]
  dp?: string
  bio?: string
  occ?: string
  /** Титул */
  t?: string
  /** Суффикс (II, III…) */
  s?: string
  /** Имя при рождении */
  bn?: string
  /** Фото: [файл в public/photos, подпись]; первое — главное */
  ph?: [string, string][]
}

function mk(p: P): Person {
  const [by, bm, bd] = Array.isArray(p.b) ? p.b : [p.b]
  const [dy, dm, dd] = Array.isArray(p.d) ? p.d : [p.d]
  const person = newPerson({
    id: p.id,
    gender: p.g,
    firstName: p.f,
    lastName: p.l,
    middleName: p.m ?? '',
    living: !p.d,
    biography: p.bio ?? '',
    title: p.t ?? '',
    suffix: p.s ?? '',
    birthName: p.bn ?? '',
  })
  person.birth = { date: { ...emptyDate(), year: by ?? null, month: bm ?? null, day: bd ?? null }, place: p.bp ?? '' }
  if (p.d) person.death = { date: { ...emptyDate(), year: dy ?? null, month: dm ?? null, day: dd ?? null }, place: p.dp ?? '', cause: '' }
  if (p.ph?.length) {
    person.photos = p.ph.map(([file, caption], i) => ({
      id: `${p.id}-ph${i}`,
      src: `${import.meta.env?.BASE_URL ?? './'}photos/${file}.svg`,
      caption,
      addedAt: 0,
    }))
    person.avatarId = person.photos[0].id
  }
  if (p.occ)
    person.facts.push({ id: `${p.id}-occ`, type: 'occupation', date: emptyDate(), place: '', description: p.occ })
  return person
}

export function fam(id: string, partners: string[], children: string[], status: FamilyStatus = 'married', year?: number): Family {
  const f = newFamily({ id, partners, children, status })
  if (year) f.marriage.date.year = year
  return f
}

export function build(id: string, name: string, home: string, persons: P[], families: Family[]): TreeData {
  return {
    version: 1,
    id,
    name,
    homePersonId: home,
    persons: Object.fromEntries(persons.map((p) => [p.id, mk(p)])),
    families: Object.fromEntries(families.map((f) => [f.id, f])),
  }
}

/** Текущее древо пользователя (как на MyHeritage). */
export function shevtsovTree(): TreeData {
  return build(
    'shevtsov',
    'Шевцов Family Tree',
    'max',
    [
      { id: 'max', g: 'M', f: 'Максим', l: 'Шевцов', b: 1991 },
      { id: 'ilya', g: 'M', f: 'Илья', l: 'Шевцов' },
      { id: 'valya', g: 'F', f: 'Валентина', l: 'Ивашева' },
      { id: 'olya', g: 'F', f: 'Оля', l: 'Макаренко' },
    ],
    [fam('f-ilya-valya', ['ilya', 'valya'], ['max']), fam('f-ilya-olya', ['ilya', 'olya'], [], 'partners')],
  )
}

/** Большое демо-древо — для проверки раскладки. */
export function demoTree(): TreeData {
  const persons: P[] = [
    // IV поколение
    { id: 'gg1', g: 'M', f: 'Пётр', l: 'Орлов', m: 'Ильич', b: 1898, d: 1965, bp: 'Тверь', dp: 'Москва', occ: 'Кузнец' },
    { id: 'gg2', g: 'F', f: 'Анна', l: 'Орлова', m: 'Васильевна', b: 1902, d: 1979, bp: 'Тверь' },
    { id: 'gg3', g: 'M', f: 'Семён', l: 'Белов', b: 1900, d: 1943, dp: 'Сталинград', occ: 'Красноармеец' },
    { id: 'gg4', g: 'F', f: 'Мария', l: 'Белова', b: 1905, d: 1990 },
    // III поколение
    { id: 'g1', g: 'M', f: 'Николай', l: 'Орлов', m: 'Петрович', b: [1928, 3, 14], d: 2004, bp: 'Москва', occ: 'Инженер' },
    { id: 'g2', g: 'F', f: 'Вера', l: 'Орлова', m: 'Семёновна', b: [1931, 7, 2], d: 2015, bp: 'Рязань', occ: 'Учитель' },
    { id: 'g1s', g: 'F', f: 'Клавдия', l: 'Орлова', b: 1925, d: 1999 },
    { id: 'g2b', g: 'M', f: 'Григорий', l: 'Белов', b: 1929, d: 2001 },
    { id: 'g3', g: 'M', f: 'Аркадий', l: 'Лебедев', b: 1930, d: 1998, bp: 'Казань' },
    { id: 'g4', g: 'F', f: 'Зоя', l: 'Лебедева', b: 1934, d: 2019 },
    // II поколение
    { id: 'fa', g: 'M', f: 'Сергей', l: 'Орлов', m: 'Николаевич', b: [1956, 11, 20], bp: 'Москва', occ: 'Архитектор' },
    { id: 'mo', g: 'F', f: 'Ирина', l: 'Орлова', m: 'Аркадьевна', b: [1959, 4, 8], bp: 'Казань' },
    { id: 'fa2', g: 'F', f: 'Людмила', l: 'Кравец', b: 1955 },
    { id: 'uncle', g: 'M', f: 'Виктор', l: 'Орлов', b: 1953 },
    { id: 'uncleW', g: 'F', f: 'Галина', l: 'Орлова', b: 1954 },
    { id: 'aunt', g: 'F', f: 'Ольга', l: 'Лебедева', b: 1962 },
    // I поколение
    { id: 'me', g: 'M', f: 'Алексей', l: 'Орлов', m: 'Сергеевич', b: [1985, 6, 12], bp: 'Москва', occ: 'Разработчик',
      bio: 'Родился в Москве. Окончил МГТУ им. Баумана. Увлекается историей семьи.' },
    { id: 'wife', g: 'F', f: 'Екатерина', l: 'Орлова', b: [1988, 2, 3] },
    { id: 'sis', g: 'F', f: 'Дарья', l: 'Смирнова', b: 1989 },
    { id: 'sisH', g: 'M', f: 'Павел', l: 'Смирнов', b: 1987 },
    { id: 'halfbro', g: 'M', f: 'Илья', l: 'Орлов', b: 1979 },
    { id: 'cousin', g: 'M', f: 'Денис', l: 'Орлов', b: 1980 },
    // 0 поколение
    { id: 'son', g: 'M', f: 'Михаил', l: 'Орлов', b: 2012 },
    { id: 'dau', g: 'F', f: 'София', l: 'Орлова', b: 2015 },
    { id: 'niece', g: 'F', f: 'Алиса', l: 'Смирнова', b: 2016 },
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
  return build('demo', 'Демо: семья Орловых', 'me', persons, families)
}

export function emptyTree(name = 'Моё семейное древо'): TreeData {
  const me = newPerson({ firstName: 'Я', gender: 'U' })
  return { version: 1, id: 'tree-' + Date.now(), name, homePersonId: me.id, persons: { [me.id]: me }, families: {} }
}
