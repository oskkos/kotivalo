import { describe, expect, test } from 'vitest'
import { rentAsked } from './rent'

const rents = [
  { validFrom: '2023-01-01', validTo: '2024-12-31', value: 85000 },
  { validFrom: '2025-01-01', validTo: null, value: 89000 },
]

describe('whether the new tenant form asks for the rent', () => {
  test('asks when the flat has no rent', () => {
    expect(rentAsked([], '2023-06-01')).toBe(true)
  })

  test('asks from the latest rent period on', () => {
    expect(rentAsked(rents, '2024-12-31')).toBe(false)
    expect(rentAsked(rents, '2025-01-01')).toBe(true)
    expect(rentAsked(rents, '2025-01-20')).toBe(true)
    expect(rentAsked(rents, '2027-01-15')).toBe(true)
  })
})
