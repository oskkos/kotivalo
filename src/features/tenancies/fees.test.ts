import { describe, expect, test } from 'vitest'
import { feeInMonth, occupantsInMonth, offeredFees } from './fees'

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

describe('Occupants and fees of a new tenancy', () => {
  const fee = (id: string, ...amounts: [string, string | null, number][]) => ({
    id,
    kind: 'parking' as const,
    basis: 'fixed' as const,
    description: null,
    amounts: amounts.map(([validFrom, validTo, value]) => ({
      validFrom,
      validTo,
      value,
    })),
  })

  test('the previous tenancy starts last before the new start', () => {
    const offered = offeredFees(
      [
        {
          id: 'a',
          validFrom: '2023-01-01',
          validTo: '2024-12-31',
          fees: [fee('old', ['2023-01-01', null, 900])],
        },
        {
          id: 'b',
          validFrom: '2025-01-01',
          validTo: '2026-12-31',
          fees: [fee('new', ['2025-01-01', null, 1500])],
        },
      ],
      '2027-01-01',
    )
    expect(offered.map((o) => [o.fee.id, o.amount])).toEqual([['new', 1500]])
  })

  test('No fees are offered for the first tenancy', () => {
    expect(offeredFees([], '2027-01-01')).toEqual([])
  })

  test("a fee ended on the tenancy's last day is not offered", () => {
    const tenancy = {
      id: 'a',
      validFrom: '2025-01-01',
      validTo: '2026-12-31',
      fees: [
        fee(
          'ended',
          ['2025-01-01', '2026-06-30', 1500],
          ['2026-07-01', null, 0],
        ),
        fee(
          'later',
          ['2025-01-01', '2026-06-30', 1500],
          ['2027-01-01', null, 0],
        ),
      ],
    }
    expect(offeredFees([tenancy], '2027-01-01').map((o) => o.fee.id)).toEqual([
      'later',
    ])
  })
})
