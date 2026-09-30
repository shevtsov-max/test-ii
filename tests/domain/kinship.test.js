import { describe, expect, it } from 'vitest'
import { demoTree } from '@/data/seed'
import { romanovTree } from '@/data/romanovs'
import { FamilyGraph } from '@/domain/graph'
import { kinshipChain, relationship } from '@/domain/kinship'

describe('подписи родства относительно «Это Вы»', () => {
  const G = new FamilyGraph(demoTree())
  it.each([
    ['me', 'Это Вы'],
    ['fa', 'Отец'],
    ['mo', 'Мать'],
    ['g1', 'Дедушка'],
    ['g4', 'Бабушка'],
    ['gg1', 'Прадедушка'],
    ['gg4', 'Прабабушка'],
    ['g1s', 'Двоюродная бабушка'],
    ['g2b', 'Двоюродный дедушка'],
    ['uncle', 'Дядя'],
    ['uncleW', 'Жена дяди'],
    ['aunt', 'Тётя'],
    ['fa2', 'Бывшая жена отца'],
    ['sis', 'Сестра'],
    ['sisH', 'Зять'],
    ['halfbro', 'Брат по отцу'],
    ['cousin', 'Двоюродный брат'],
    ['wife', 'Жена'],
    ['son', 'Сын'],
    ['dau', 'Дочь'],
    ['niece', 'Племянница'],
  ])('%s — %s', (id, label) => {
    expect(relationship(G, 'me', id)).toBe(label)
  })

  it('королевские дома: схлопывание предков и свойственники', () => {
    const R = new FamilyGraph(romanovTree())
    expect(relationship(R, 'nik2', 'george5')).toBe('Двоюродный брат')
    expect(relationship(R, 'nik2', 'alexei')).toBe('Сын')
    expect(relationship(R, 'nik2', 'felix')).toBe('Муж племянницы')
  })

  it('цепочка родства ведёт от одного человека к другому', () => {
    const chain = kinshipChain(G, 'me', 'cousin')
    expect(chain.map((x) => x.id)).toEqual(['me', 'fa', 'uncle', 'cousin'])
    expect(chain.slice(1).map((x) => x.word)).toEqual(['отец', 'брат', 'сын'])
  })
})
