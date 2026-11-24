import { describe, expect, test } from 'vitest'
import { feeInMonth, occupantsInMonth } from './fees'

const period = (validFrom: string, validTo: string | null, value: number) => ({
  validFrom,
  validTo,
  value,
})

describe('Tenant fees are recorded as periods', () => {
  const tenancy = { validFrom: '2025-03-01' }

  test('A per-occupant water fee', () => {
    const occupants = [
      period('2025-03-01', '2026-08-31', 1),
      period('2026-09-01', null, 2),
    ]
    const water = {
      basis: 'per_occupant' as const,
      amounts: [period('2025-03-01', null, 2200)],
    }
    expect(feeInMonth(water, occupants, tenancy, '2026-08')).toBe(2200)
    expect(feeInMonth(water, occupants, tenancy, '2026-09')).toBe(4400)
  })

  test('A parking fee taken mid-tenancy', () => {
    const parking = {
      basis: 'fixed' as const,
      amounts: [period('2026-02-01', null, 1500)],
    }
    const occupants = [period('2025-03-01', null, 2)]
    expect(feeInMonth(parking, occupants, tenancy, '2026-02')).toBe(1500)
    expect(feeInMonth(parking, occupants, tenancy, '2026-01')).toBeUndefined()
  })

  test('a fee changing amount follows its own periods', () => {
    const parking = {
      basis: 'fixed' as const,
      amounts: [
        period('2026-02-01', '2026-12-31', 1500),
        period('2027-01-01', null, 0),
      ],
    }
    expect(feeInMonth(parking, [], tenancy, '2026-12')).toBe(1500)
    expect(feeInMonth(parking, [], tenancy, '2027-01')).toBe(0)
  })

  test('a tenancy without occupants counts one', () => {
    const water = {
      basis: 'per_occupant' as const,
      amounts: [period('2025-03-01', null, 2200)],
    }
    expect(feeInMonth(water, [], tenancy, '2026-02')).toBe(2200)
    expect(occupantsInMonth([], tenancy, '2026-02')).toBeUndefined()
  })
})
