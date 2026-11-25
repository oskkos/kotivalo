import { describe, expect, test } from 'vitest'
import { isValidBusinessId } from './business-id'

describe('Housing company details of a flat', () => {
  test('A Business ID with a wrong check digit is not saved', () => {
    // Remainder 0 gives the check digit 0, remainder 2 gives 11 - 2 = 9.
    expect(isValidBusinessId('2345678-0')).toBe(true)
    expect(isValidBusinessId('0112038-9')).toBe(true)

    expect(isValidBusinessId('2345678-9')).toBe(false)
    expect(isValidBusinessId('0112038-8')).toBe(false)
    // Remainder 1 is never valid, whatever the check digit.
    for (let digit = 0; digit <= 9; digit++) {
      expect(isValidBusinessId(`3141592-${String(digit)}`)).toBe(false)
    }
  })

  test('A Business ID in the wrong form is not saved', () => {
    expect(isValidBusinessId('2345678')).toBe(false)
    expect(isValidBusinessId('23456780')).toBe(false)
    expect(isValidBusinessId('234567-80')).toBe(false)
    expect(isValidBusinessId('2345678-')).toBe(false)
    expect(isValidBusinessId('2345678-00')).toBe(false)
    expect(isValidBusinessId('abcdefg-0')).toBe(false)
    expect(isValidBusinessId(' 2345678-0')).toBe(false)
    expect(isValidBusinessId('')).toBe(false)
  })
})
