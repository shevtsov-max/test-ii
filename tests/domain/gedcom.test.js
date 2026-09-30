import { describe, expect, it } from 'vitest'
import { romanovTree } from '@/data/romanovs'
import { exportGedcom, importGedcom } from '@/domain/gedcom'
import { looksLikeTree, migrateTree } from '@/domain/migrate'
import { placeFullName } from '@/domain/places'

describe('GEDCOM', () => {
  const t = romanovTree()
  const ged = exportGedcom(t)
  const back = importGedcom(ged, 'Импорт')

  it('выгрузка — корректный GEDCOM 5.5.1 с кириллицей', () => {
    expect(ged.startsWith('0 HEAD')).toBe(true)
    expect(ged).toMatch(/1 CHAR UTF-8/)
    expect(ged.trim().endsWith('0 TRLR')).toBe(true)
  })

  it('люди и семьи переживают выгрузку и загрузку', () => {
    expect(Object.keys(back.persons)).toHaveLength(Object.keys(t.persons).length)
    expect(Object.keys(back.families)).toHaveLength(Object.keys(t.families).length)
    const nik = Object.values(back.persons).find((p) => p.firstName === 'Николай' && p.suffix === 'II')
    expect(nik).toBeTruthy()
    expect(nik.title).toBe('Император')
    expect(nik.birth.date).toMatchObject({ day: 18, month: 5, year: 1868 })
    expect(placeFullName(back, nik.birth.placeId)).toBe(placeFullName(t, t.persons.nik2.birth.placeId))
  })

  it('скрытие сведений о живых', () => {
    const living = Object.values(t.persons).find((p) => p.living && p.birth.date.year)
    const hidden = exportGedcom(t, { hideLiving: true })
    const back2 = importGedcom(hidden, 'x')
    const same = Object.values(back2.persons).find((p) => p.firstName === living.firstName && p.lastName === living.lastName)
    expect(same.birth.date.year).toBeFalsy()
  })
})

describe('миграция данных', () => {
  it('текущая версия не меняется повторной миграцией', () => {
    const t = romanovTree()
    expect(looksLikeTree(t)).toBe(true)
    expect(migrateTree(t)).toEqual(t)
  })
  it('посторонний JSON не принимается за древо', () => {
    expect(looksLikeTree({ a: 1 })).toBe(false)
  })
})
