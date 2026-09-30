import { describe, expect, it } from 'vitest'
import { formalName, fullName, patronymicFrom, shortName, surnameFor } from '@/domain/names'
import { demoTree } from '@/data/seed'
import { romanovTree } from '@/data/romanovs'

describe('русские имена', () => {
  it.each([
    ['Шевцов', 'F', 'Шевцова'],
    ['Толстой', 'F', 'Толстая'],
    ['Чайковский', 'F', 'Чайковская'],
    ['Шевчук', 'F', 'Шевчук'],
    ['Шевцова', 'M', 'Шевцов'],
  ])('фамилия %s в роде %s → %s', (s, g, expected) => {
    expect(surnameFor(s, g)).toBe(expected)
  })

  it.each([
    ['Илья', 'M', 'Ильич'],
    ['Илья', 'F', 'Ильинична'],
    ['Николай', 'M', 'Николаевич'],
    ['Пётр', 'F', 'Петровна'],
    ['Сергей', 'F', 'Сергеевна'],
  ])('отчество от «%s» (%s) → %s', (name, g, expected) => {
    expect(patronymicFrom(name, g)).toBe(expected)
  })

  it('полное, краткое и официальное имя', () => {
    const t = demoTree()
    expect(fullName(t.persons.me)).toBe('Алексей Сергеевич Орлов')
    expect(shortName(t.persons.me)).toBe('Алексей Орлов')
    expect(formalName(t.persons.mo)).toBe('Орлова (Лебедева) Ирина Аркадьевна')
  })

  it('титулованные особы', () => {
    const t = romanovTree()
    expect(formalName(t.persons.nik2)).toBe('Романов Николай Александрович')
  })
})
