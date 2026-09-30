import { describe, expect, it } from 'vitest'
import { demoTree } from '@/data/seed'
import { FamilyGraph } from '@/domain/graph'
import { ancestorReport, descendantReport, reportToText } from '@/domain/reports'
import { checkTree, findDuplicates } from '@/domain/validation'
import { treeStats } from '@/domain/stats'
import { produce } from 'immer'

const G = new FamilyGraph(demoTree())

describe('росписи', () => {
  it('поколенная роспись: сквозная нумерация и ссылки на родителя', () => {
    const r = descendantReport(G, 'gg1')
    expect(r.total).toBe(12)
    const flat = r.generations.flatMap((g) => g.entries)
    const me = flat.find((e) => e.personId === 'me')
    const fa = flat.find((e) => e.personId === 'fa')
    expect(me.parentNum).toBe(fa.num)
    expect(reportToText(r)).toMatch(/КОЛЕНО I\b/)
  })

  it('только мужская линия не расписывает потомство дочерей', () => {
    const r = descendantReport(G, 'fa', { maleLine: true })
    const ids = r.generations.flatMap((g) => g.entries.map((e) => e.personId))
    expect(ids).toContain('sis')
    expect(ids).not.toContain('niece')
  })

  it('восходящая роспись по Соса — Страдоница', () => {
    const r = ancestorReport(G, 'me')
    const num = Object.fromEntries(r.generations.flatMap((g) => g.entries.map((e) => [e.personId, e.num])))
    expect(num).toMatchObject({ me: 1, fa: 2, mo: 3, g1: 4, g2: 5, g3: 6, g4: 7, gg1: 8 })
  })
})

describe('проверка данных', () => {
  it('демо-древо без противоречий', () => {
    expect(checkTree(G)).toEqual([])
    expect(findDuplicates(G)).toEqual([])
  })

  it('находит смерть раньше рождения и ребёнка старше родителя', () => {
    const t = produce(demoTree(), (d) => {
      d.persons.gg1.death.date.year = 1890
      d.persons.son.birth.date.year = 1970
    })
    const codes = checkTree(new FamilyGraph(t)).map((i) => i.code)
    expect(codes).toContain('death-before-birth')
    expect(codes).toContain('child-before-parent')
  })
})

describe('статистика', () => {
  it('считает людей, поколения и частые фамилии в мужской форме', () => {
    const s = treeStats(G)
    expect(s.persons).toBe(25)
    expect(s.generations).toBe(5)
    expect(s.surnames[0]).toEqual({ label: 'Орлов', value: expect.any(Number) })
  })
})
