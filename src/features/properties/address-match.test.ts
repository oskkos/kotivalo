import { describe, expect, test } from 'vitest'
import { addressMatches } from './address-match'

describe('addressMatches', () => {
  test('ignores letter case', () => {
    expect(addressMatches('kuusikuja 3 b 12', 'Kuusikuja 3 B 12')).toBe(true)
    expect(addressMatches('MÄNTYTIE 9 A 2', 'Mäntytie 9 A 2')).toBe(true)
  })

  test('ignores spaces around and extra spaces between words', () => {
    expect(addressMatches('  Kuusikuja  3 B\t12 ', 'Kuusikuja 3 B 12')).toBe(
      true,
    )
  })

  test('a part of the address does not match', () => {
    expect(addressMatches('Kuusikuja 3 B', 'Kuusikuja 3 B 12')).toBe(false)
    expect(addressMatches('', 'Kuusikuja 3 B 12')).toBe(false)
  })

  test('spaces still separate words', () => {
    expect(addressMatches('Kuusikuja 3B 12', 'Kuusikuja 3 B 12')).toBe(false)
  })
})
