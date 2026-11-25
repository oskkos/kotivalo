import { describe, expect, test } from 'vitest'
import { m } from '#/paraglide/messages.js'
import { locales } from '#/paraglide/runtime.js'
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

describe('isValidBusinessId', () => {
  test('the example in the placeholder and the error is a valid Business ID', () => {
    for (const locale of locales) {
      for (const text of [
        m.property_business_id_placeholder({}, { locale }),
        m.reason_business_id_invalid({}, { locale }),
      ]) {
        const example = /\d{7}-\d/.exec(text)?.[0]
        expect(example).toBeDefined()
        expect(isValidBusinessId(example ?? '')).toBe(true)
      }
    }
  })
})
