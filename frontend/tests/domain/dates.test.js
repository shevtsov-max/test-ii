import { describe, expect, it } from 'vitest'
import { formatDate, julianToGregorian, parseDateText, sortKey, yearsBetween } from '@/domain/dates'

const fmt = (s) => formatDate(parseDateText(s))

describe('parseDateText — ввод даты одной строкой', () => {
  it.each([
    ['13.05.1991', '13 мая 1991'],
    ['1991-05-13', '13 мая 1991'],
    ['13 мая 1991', '13 мая 1991'],
    ['05.1991', 'май 1991'],
    ['май 1991', 'май 1991'],
    ['авг 1914', 'август 1914'],
    ['июня 1900', 'июнь 1900'],
    ['октябрь 1917', 'октябрь 1917'],
    ['1991', '1991'],
    ['ок. 1880', 'ок. 1880'],
    ['около 1880 г.', 'ок. 1880'],
    ['до 1900', 'до 1900'],
    ['после 1900', 'после 1900'],
    ['1880?', 'предп. 1880'],
    ['1880-е', 'между 1880 и 1889'],
    ['1880-1885', 'между 1880 и 1885'],
    ['1880-85', 'между 1880 и 1885'],
    ['между 1880 и 1885', 'между 1880 и 1885'],
    ['с 1941 по 1945', 'между 1941 и 1945'],
  ])('%s → %s', (input, expected) => {
    expect(fmt(input)).toBe(expected)
  })

  it('старый стиль показывает обе даты', () => {
    expect(fmt('6.05.1868 ст. ст.')).toBe('6 (18) мая 1868')
    expect(fmt('25 февраля 1917 ст.ст.')).toBe('25 февраля (10 марта) 1917')
    expect(parseDateText('6.05.1868 ст. ст.').calendar).toBe('julian')
  })

  it('непонятный текст не превращается в дату', () => {
    expect(parseDateText('xx')).toBeNull()
  })
})

describe('календарь и арифметика', () => {
  it('юлианская дата переводится в григорианскую', () => {
    expect(julianToGregorian(6, 5, 1868)).toMatchObject({ day: 18, month: 5, year: 1868 })
    expect(julianToGregorian(25, 10, 1917)).toMatchObject({ day: 7, month: 11, year: 1917 })
  })

  it('сортировка учитывает точность даты', () => {
    const a = parseDateText('май 1991')
    const b = parseDateText('13.05.1991')
    const c = parseDateText('1992')
    expect(sortKey(a)).toBeLessThanOrEqual(sortKey(b))
    expect(sortKey(b)).toBeLessThan(sortKey(c))
  })

  it('возраст считается по полным годам', () => {
    expect(yearsBetween(parseDateText('13.05.1991'), parseDateText('12.05.2021')).years).toBe(29)
    expect(yearsBetween(parseDateText('13.05.1991'), parseDateText('13.05.2021')).years).toBe(30)
  })
})
