import { describe, expect, it } from 'vitest'
import { produce } from 'immer'
import { demoTree, starterTree } from '@/data/seed'
import { FamilyGraph } from '@/domain/graph'
import { relationship } from '@/domain/kinship'
import * as A from '@/domain/actions'
import { placeFullName } from '@/domain/places'

const run = (t, fn) => {
  let out
  const next = produce(t, (d) => {
    out = fn(d)
  })
  return [next, out]
}

describe('изменение древа', () => {
  it('добавление отца создаёт семью родителей и связывает с матерью', () => {
    const t = starterTree({ me: { firstName: 'Максим', lastName: 'Шевцов', gender: 'M' }, mother: { firstName: 'Валентина' } })
    const me = t.homePersonId
    const [t2, fatherId] = run(t, (d) => A.addRelative(d, me, 'father', { firstName: 'Илья' }))
    const G = new FamilyGraph(t2)
    expect(G.parents(me).father).toBe(fatherId)
    expect(G.parents(me).mother).toBeTruthy()
    expect(t2.persons[fatherId].gender).toBe('M')
    expect(relationship(G, me, fatherId)).toBe('Отец')
  })

  it('персону нельзя сделать родителем собственного предка', () => {
    const t = demoTree()
    expect(() => run(t, (d) => A.addRelative(d, 'fa', 'father', {}, { existingId: 'me' }))).toThrow(/потомок/)
  })

  it('приёмные родители — отдельная семья с пометкой', () => {
    const t = demoTree()
    const [t2, id] = run(t, (d) => A.addRelative(d, 'me', 'mother', { firstName: 'Анна' }, { link: 'foster' }))
    const G = new FamilyGraph(t2)
    const fams = G.parentFamilies('me')
    expect(fams).toHaveLength(2)
    const foster = fams.find((f) => f.partners.includes(id))
    expect(foster.childLinks.me).toBe('foster')
    // Основные (кровные) родители остаются прежними
    expect(G.parents('me').father).toBe('fa')
  })

  it('удаление персоны чистит семьи и переносит «Это Вы»', () => {
    const t = demoTree()
    const [t2] = run(t, (d) => A.deletePerson(d, 'me'))
    expect(t2.persons.me).toBeUndefined()
    expect(Object.values(t2.families).some((f) => f.children.includes('me') || f.partners.includes('me'))).toBe(false)
    expect(t2.persons[t2.homePersonId]).toBeTruthy()
  })

  it('объединение дубликатов переносит связи', () => {
    const t = demoTree()
    const [t1, dup] = run(t, (d) => A.addPerson(d, { firstName: 'Алексей', lastName: 'Орлов', gender: 'M', occupation: 'Инженер' }))
    const [t2, kid] = run(t1, (d) => A.addRelative(d, dup, 'son', { firstName: 'Пётр' }))
    const [t3] = run(t2, (d) => A.mergePersons(d, 'me', dup))
    expect(t3.persons[dup]).toBeUndefined()
    expect(new FamilyGraph(t3).children('me')).toContain(kid)
  })
})

describe('мастер «Новое древо»', () => {
  it('подставляет отчество, фамилии родителей и иерархию места', () => {
    const t = starterTree({
      name: 'Семья Шевцовых',
      me: { firstName: 'Максим', lastName: 'Шевцов', gender: 'M' },
      birthPlace: 'Россия, Ставрополь',
      father: { firstName: 'Илья' },
      mother: { firstName: 'Валентина', birthName: 'Ивашев' },
    })
    const G = new FamilyGraph(t)
    const me = t.persons[t.homePersonId]
    const { father, mother } = G.parents(me.id)
    expect(me.middleName).toBe('Ильич')
    expect(t.persons[father].lastName).toBe('Шевцов')
    expect(t.persons[mother]).toMatchObject({ lastName: 'Шевцова', birthName: 'Ивашева', gender: 'F' })
    expect(placeFullName(t, me.birth.placeId)).toBe('Россия, Ставрополь')
    expect(Object.keys(t.places)).toHaveLength(2)
  })
})
