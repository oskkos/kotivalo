import { describe, expect, test } from 'vitest'
import { typedOccupants } from './schemas'

describe('Occupants of a tenancy', () => {
  test('Zero occupants is refused', () => {
    for (const text of ['0', '21', '', '1,5', 'two', '-1']) {
      const result = typedOccupants.safeParse(text)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe('occupants_invalid')
    }
  })

  test('a whole number from 1 to 20 is accepted', () => {
    expect(typedOccupants.parse('1')).toBe(1)
    expect(typedOccupants.parse(' 20 ')).toBe(20)
  })
})
