import { describe, expect, it } from 'vitest'
import { passwordStrength, validatePassword } from '@/utils/password'
import { collectChanges, emptyChanges, hasChanges } from '@/api/changes'
import { produceWithPatches, enablePatches } from 'immer'
import { demoTree } from '@/data/seed'

enablePatches()

describe('пароль', () => {
  it('требования', () => {
    expect(validatePassword('short1')).toMatch(/8/)
    expect(validatePassword('onlyletters')).toMatch(/цифры/)
    expect(validatePassword('secret123')).toBe('')
  })
  it('надёжность растёт с длиной и разнообразием', () => {
    expect(passwordStrength('secret123').score).toBeLessThan(passwordStrength('Secret-123-long').score)
  })
})

describe('набор изменений для сервера', () => {
  it('патчи immer превращаются в изменённые и удалённые записи', () => {
    const t = demoTree()
    const [, patches] = produceWithPatches(t, (d) => {
      d.persons.me.firstName = 'Лёша'
      delete d.persons.niece
    })
    const acc = emptyChanges()
    collectChanges(acc, patches)
    expect(hasChanges(acc)).toBe(true)
    expect(acc.upsert.persons.has('me')).toBe(true)
    expect(acc.remove.persons.has('niece')).toBe(true)
  })
})
