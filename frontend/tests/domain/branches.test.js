import { describe, expect, it } from 'vitest'
import { produceWithPatches, enablePatches } from 'immer'
import { demoTree } from '@/data/seed'
import { applyBranches, branchPersonIds, touchesLocked } from '@/domain/branches'
import * as A from '@/domain/actions'
import { FamilyGraph } from '@/domain/graph'

enablePatches()

/** Ветка дяди, как её отдаёт сервер (delegatedBranches): родственник добавил внучку. */
function uncleBranch(t) {
  const ids = branchPersonIds(t, 'uncle')
  const persons = Object.fromEntries(ids.map((id) => [id, t.persons[id]]))
  const families = Object.fromEntries(Object.entries(t.families).filter(([, f]) => f.partners.length && f.partners.every((p) => ids.includes(p))))
  const cousinFamily = Object.values(families).find((f) => f.children.includes('cousin'))
  persons.grandkid = { ...t.persons.cousin, id: 'grandkid', firstName: 'Мила', gender: 'F' }
  families.fk = { ...cousinFamily, id: 'fk', partners: ['cousin'], children: ['grandkid'], childLinks: {} }
  return { delegation: { id: 'd1', personIds: ids, status: 'active' }, data: { persons, families, media: {}, places: {}, sources: {}, clans: {} } }
}

describe('переданные ветки', () => {
  it('ветка: персона, потомки и их супруги — без родителей и братьев', () => {
    const t = demoTree()
    const ids = branchPersonIds(t, 'uncle')
    expect(ids).toEqual(expect.arrayContaining(['uncle', 'uncleW', 'cousin']))
    expect(ids).not.toContain('g1')
    expect(ids).not.toContain('fa')
  })

  it('живые данные родственника показываются в древе владельца и закрыты для правки', () => {
    const t = demoTree()
    const b = uncleBranch(t)
    const { tree, locked, owner } = applyBranches(t, [b])
    expect(tree.persons.grandkid.firstName).toBe('Мила')
    expect(new FamilyGraph(tree).children('cousin')).toContain('grandkid')
    // Дядя по-прежнему сын своих родителей из древа владельца
    expect(new FamilyGraph(tree).parents('uncle').father).toBe('g1')
    expect(locked.persons.has('grandkid')).toBe(true)
    expect(locked.persons.has('me')).toBe(false)
    expect(owner.cousin).toBe('d1')
  })

  it('правки ветки блокируются, остального древа — нет', () => {
    const t = demoTree()
    const { tree, locked } = applyBranches(t, [uncleBranch(t)])
    const check = (fn) => {
      const [next, patches] = produceWithPatches(tree, (d) => {
        fn(d)
      })
      return touchesLocked(patches, locked, tree, next)
    }
    expect(check((d) => A.updatePerson(d, 'cousin', { occupation: 'Инженер' }))).toBe(true)
    expect(check((d) => A.addRelative(d, 'uncle', 'partner', { firstName: 'Анна' }))).toBe(true)
    expect(check((d) => A.deletePerson(d, 'grandkid'))).toBe(true)
    expect(check((d) => A.updatePerson(d, 'me', { occupation: 'Историк' }))).toBe(false)
    expect(check((d) => void (d.homePersonId = 'cousin'))).toBe(false)
  })

  it('без переданных веток ничего не меняется', () => {
    const t = demoTree()
    const r = applyBranches(t, [], [])
    expect(r.tree).toBe(t)
    expect(r.locked.persons.size).toBe(0)
  })
})
