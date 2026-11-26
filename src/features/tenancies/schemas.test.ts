import { describe, expect, test } from 'vitest'
import { typedDeposit, typedOccupants } from './schemas'

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

describe("A tenancy's deposit", () => {
  test('An invalid deposit is refused', () => {
    for (const text of ['0', '1780,555', 'abc', '-5', '100000,01']) {
      const result = typedDeposit.safeParse(text)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe('deposit_amount_invalid')
    }
  })

  test('a deposit in euros becomes cents, and empty means none', () => {
    expect(typedDeposit.parse('1780')).toBe(178000)
    expect(typedDeposit.parse(' 1 780,50 ')).toBe(178050)
    expect(typedDeposit.parse('')).toBeNull()
  })
})
