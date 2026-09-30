/**
 * Колонки таблицы «Персоны». Набор и порядок настраиваются пользователем (prefs.people.columns).
 */
import { formatDate, sortKey } from '@/domain/dates'
import { formalName, sortName } from '@/domain/names'
import { ageOf, completeness, mainOccupation, residenceId } from '@/domain/person'
import { placeName } from '@/domain/places'

/**
 * @param {{ tree: object, graph: object, relation: (id: string) => string }} ctx
 */
export function peopleColumns(ctx) {
  const t = ctx.tree
  const G = ctx.graph
  const age = (p) => ageOf(p)?.years ?? null
  const cols = [
    { name: 'name', label: 'Полное имя', required: true, align: 'left', sortable: true, field: (p) => formalName(p), sort: (_a, _b, ra, rb) => sortName(ra).localeCompare(sortName(rb), 'ru'), style: 'min-width: 240px' },
    { name: 'relation', label: 'Родство', align: 'left', sortable: true, field: (p) => ctx.relation(p.id) },
    { name: 'gender', label: 'Пол', align: 'center', sortable: true, field: (p) => (p.gender === 'M' ? 'М' : p.gender === 'F' ? 'Ж' : '?'), style: 'width: 52px' },
    { name: 'birth', label: 'Дата рождения', align: 'left', sortable: true, field: (p) => formatDate(p.birth.date, 'numeric'), sort: (_a, _b, ra, rb) => sortKey(ra.birth.date) - sortKey(rb.birth.date) },
    { name: 'birthPlace', label: 'Место рождения', align: 'left', sortable: true, field: (p) => placeName(t, p.birth.placeId) },
    { name: 'death', label: 'Дата смерти', align: 'left', sortable: true, field: (p) => (p.living ? '' : formatDate(p.death.date, 'numeric') || '†'), sort: (_a, _b, ra, rb) => sortKey(ra.death.date) - sortKey(rb.death.date) },
    { name: 'deathPlace', label: 'Место смерти', align: 'left', sortable: true, field: (p) => (p.living ? '' : placeName(t, p.death.placeId)) },
    { name: 'age', label: 'Возраст', align: 'right', sortable: true, field: (p) => age(p) ?? '', sort: (_a, _b, ra, rb) => (age(ra) ?? -1) - (age(rb) ?? -1), style: 'width: 80px' },
    { name: 'residence', label: 'Место жительства', align: 'left', sortable: true, field: (p) => placeName(t, residenceId(p)) },
    { name: 'occupation', label: 'Основное занятие', align: 'left', sortable: true, field: (p) => mainOccupation(p) },
    { name: 'clan', label: 'Род', align: 'left', sortable: true, field: (p) => (p.clanId ? (t.clans[p.clanId]?.name ?? '') : '') },
    { name: 'note', label: 'Комментарий', align: 'left', sortable: false, field: (p) => p.note || p.biography, style: 'min-width: 220px; max-width: 320px' },
    { name: 'living', label: 'В живых', align: 'center', sortable: true, field: (p) => (p.living ? 1 : 0), style: 'width: 80px' },
    { name: 'photo', label: 'Есть фото', align: 'center', sortable: true, field: (p) => (p.avatarId ? 1 : 0), style: 'width: 86px' },
    { name: 'children', label: 'Детей', align: 'right', sortable: true, field: (p) => G.children(p.id).length, style: 'width: 72px' },
    { name: 'quality', label: 'Заполненность', align: 'left', sortable: true, field: (p) => completeness(G, p).score, style: 'width: 130px' },
    { name: 'updated', label: 'Изменено', align: 'left', sortable: true, field: (p) => p.updatedAt, format: (v) => new Date(v).toLocaleDateString('ru-RU') },
  ]
  for (const f of t.customFields ?? []) {
    cols.push({ name: 'cf:' + f.id, label: f.label, align: 'left', sortable: true, field: (p) => p.custom?.[f.id] ?? '', custom: true })
  }
  return cols
}

export const COLUMN_LABELS = {
  name: 'Полное имя',
  relation: 'Родство',
  gender: 'Пол',
  birth: 'Дата рождения',
  birthPlace: 'Место рождения',
  death: 'Дата смерти',
  deathPlace: 'Место смерти',
  age: 'Возраст',
  residence: 'Место жительства',
  occupation: 'Основное занятие',
  clan: 'Род',
  note: 'Комментарий',
  living: 'В живых',
  photo: 'Есть фото',
  children: 'Детей',
  quality: 'Заполненность',
  updated: 'Изменено',
}
