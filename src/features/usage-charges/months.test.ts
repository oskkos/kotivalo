import { describe, expect, test } from 'vitest'
import {
  usageChargeYears,
  usageChargesOfMonth,
  usageChargesOfYear,
  type OccupiedTenancy,
  type UsageChargePeriods,
} from './months'
import { USAGE_CHARGE_ROWS } from './rows'

const period = (validFrom: string, validTo: string | null, value: number) => ({
  validFrom,
  validTo,
  value,
})

const water = (
  ...periods: ReturnType<typeof period>[]
): UsageChargePeriods => ({
  id: 'water',
  kind: 'water',
  basis: 'per_occupant',
  description: null,
  periods,
})

const parking = (
  ...periods: ReturnType<typeof period>[]
): UsageChargePeriods => ({
  id: 'parking',
  kind: 'parking',
  basis: 'fixed',
  description: null,
  periods,
})

const aino: OccupiedTenancy = {
  validFrom: '2025-03-01',
  validTo: null,
  occupants: [
    period('2025-03-01', '2026-08-31', 1),
    period('2026-09-01', null, 2),
  ],
}

const cents = (
  charges: UsageChargePeriods[],
  tenancies: OccupiedTenancy[],
  month: string,
) => usageChargesOfMonth(charges, tenancies, month)?.charges[0]?.cents

describe('Usage charges are recorded as monthly periods', () => {
  test("A usage charge's month comes from the period containing its first day", () => {
    const charge = water(
      period('2025-03-01', '2025-12-31', 2000),
      period('2026-01-01', null, 2200),
    )
    const one = [{ ...aino, occupants: [period('2025-03-01', null, 1)] }]
    expect(cents([charge], one, '2025-12')).toBe(2000)
    expect(cents([charge], one, '2026-01')).toBe(2200)
    expect(usageChargesOfMonth([charge], one, '2025-02')).toBeUndefined()
  })

  test('Two parking spaces are two usage charges', () => {
    const second = {
      ...parking(period('2026-01-01', null, 2500)),
      id: 'second',
    }
    const month = usageChargesOfMonth(
      [parking(period('2025-03-01', null, 1500)), second],
      [],
      '2026-01',
    )
    expect(month?.charges.map((c) => c.cents)).toEqual([1500, 2500])
    expect(month?.total).toBe(4000)
  })
})

describe('Usage charges of a month', () => {
  test('A per-occupant charge follows the occupants', () => {
    const charge = water(period('2026-01-01', null, 2200))
    expect(cents([charge], [aino], '2026-08')).toBe(2200)
    const september = usageChargesOfMonth([charge], [aino], '2026-09')
    expect(september?.charges[0]).toMatchObject({
      cents: 4400,
      persons: 2,
      perUnit: 2200,
      previous: 2200,
    })
  })

  test('A vacant flat counts one occupant', () => {
    const ended = {
      validFrom: '2025-03-01',
      validTo: '2026-12-31',
      occupants: [period('2025-03-01', null, 2)],
    }
    expect(
      cents([water(period('2026-01-01', null, 2200))], [ended], '2027-01'),
    ).toBe(2200)
  })

  test("The tenancy on the month's first day decides", () => {
    const pekka = {
      validFrom: '2024-01-01',
      validTo: '2026-11-14',
      occupants: [period('2024-01-01', null, 3)],
    }
    const ainoLater = {
      validFrom: '2026-11-15',
      validTo: null,
      occupants: [period('2026-11-15', null, 1)],
    }
    const charge = water(period('2026-01-01', null, 2200))
    expect(cents([charge], [pekka, ainoLater], '2026-11')).toBe(6600)
    expect(cents([charge], [pekka, ainoLater], '2026-12')).toBe(2200)
  })

  test('A fixed charge is not divided by days', () => {
    const tenancy = {
      validFrom: '2026-02-15',
      validTo: null,
      occupants: [period('2026-02-15', null, 2)],
    }
    expect(
      cents([parking(period('2026-02-01', null, 1500))], [tenancy], '2026-02'),
    ).toBe(1500)
  })

  test("A year's usage charges", () => {
    const charges = [
      water(period('2026-01-01', null, 2200)),
      parking(period('2026-02-01', null, 1500)),
    ]
    const year = usageChargesOfYear(charges, [aino], 2026, '2026-11-24')
    expect(year.months.map((m) => m.month)).toEqual([
      '2026-11',
      '2026-10',
      '2026-09',
      '2026-08',
      '2026-07',
      '2026-06',
      '2026-05',
      '2026-04',
      '2026-03',
      '2026-02',
      '2026-01',
    ])
    expect(year.months.at(-1)?.total).toBe(2200)
    expect(year.months[0]?.total).toBe(5900)
    expect(year.total).toBe(45800)
    expect(year.sums.map((s) => [s.id, s.cents])).toEqual([
      ['water', 30800],
      ['parking', 15000],
    ])
  })

  test('the years run from the first period to the current one', () => {
    expect(
      usageChargeYears([water(period('2024-05-01', null, 2200))], '2026-11-24'),
    ).toEqual([2026, 2025, 2024])
    expect(usageChargeYears([], '2026-11-24')).toEqual([])
    expect(
      usageChargeYears([water(period('2027-01-01', null, 2200))], '2026-11-24'),
    ).toEqual([])
  })
})

describe('Usage charge rows on form 7H', () => {
  test('Water goes with the maintenance charges', () => {
    expect(USAGE_CHARGE_ROWS.water).toBe('maintenance_and_water')
  })

  test('Parking is another cost', () => {
    expect(USAGE_CHARGE_ROWS.parking).toBe('other_costs')
    expect(USAGE_CHARGE_ROWS.sauna).toBe('other_costs')
    expect(USAGE_CHARGE_ROWS.other).toBe('other_costs')
  })
})
