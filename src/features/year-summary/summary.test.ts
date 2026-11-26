import { describe, expect, test } from 'vitest'
import type { Period } from '#/features/ownership/periods'
import type { Period as ValuePeriod } from '#/features/recurring-amounts/periods'
import type { FinancingTreatment } from '#/server/db/schema'
import {
  clampYear,
  flatYear,
  openingYear,
  summaryYears,
  type FlatYearInput,
  type SummaryEntry,
  type SummaryTenancy,
} from './summary'

const TODAY = '2026-11-25'

/** The user's ownership as periods: `[share, from, to]` each. */
const ownership = (...spans: [number, string, string | null][]): Period[] =>
  spans.map(([share, validFrom, validTo]) => ({
    validFrom,
    validTo,
    reason: null,
    shares: [{ userId: 'annika', share }],
  }))

const always = (share: number) => ownership([share, '2024-01-01', null])

const amount = (
  value: number,
  validFrom = '2024-01-01',
  validTo: string | null = null,
): ValuePeriod<number> => ({ validFrom, validTo, value })

const input = (over: Partial<FlatYearInput> = {}): FlatYearInput => ({
  propertyId: 'flat',
  housingCompany: {
    name: 'As Oy Kuusikuja',
    businessId: '0112038-9',
    apartmentNumber: 'B 12',
  },
  ownership: always(10000),
  tenancies: [],
  payments: [],
  entries: [],
  charges: { maintenance: [], financing: [] },
  treatments: [],
  usageCharges: [],
  ...over,
})

const tenancy = (over: Partial<SummaryTenancy> = {}): SummaryTenancy => ({
  id: 't',
  tenantName: 'Aino Koski',
  validFrom: '2025-01-01',
  validTo: null,
  dueDay: 5,
  occupants: [],
  rent: [amount(89000, '2025-01-01')],
  fees: [],
  ...over,
})

const treatment = (
  value: FinancingTreatment,
  validFrom: string,
  validTo: string | null = null,
): ValuePeriod<FinancingTreatment> => ({ validFrom, validTo, value })

const payment = (month: string, amountCents: number, paidOn: string) => ({
  tenancyId: 't',
  month,
  amount: amountCents,
  paidOn,
})

const entry = (
  category: SummaryEntry['category'],
  amountCents: number,
  date: string,
): SummaryEntry => ({ category, amount: amountCents, date })

const rentIn2025 = (paidOnDay = '04') =>
  Array.from({ length: 11 }, (_, i) => {
    const month = `2025-${String(i + 1).padStart(2, '0')}`
    return payment(month, 89000, `${month}-${paidOnDay}`)
  })

const year = (data: FlatYearInput, y = 2025, today = TODAY) =>
  flatYear(data, 'annika', y, today)

describe('Form 7H rows of the own share', () => {
  test('Rent counts in the year it was paid', () => {
    const data = input({
      payments: [...rentIn2025(), payment('2025-12', 89000, '2026-01-02')],
    })
    expect(year(data).rows['2.1'].cents).toBe(979000)
    expect(year(data, 2026).rows['2.1'].cents).toBe(89000)
  })

  test('Income entries add to the rent', () => {
    const data = input({
      payments: rentIn2025(),
      entries: [entry('other_income', 12000, '2025-05-10')],
    })
    expect(year(data).rows['2.1']).toEqual({
      cents: 991000,
      parts: [
        { key: 'rent_payments', cents: 979000 },
        { key: 'other_income', cents: 12000 },
      ],
    })
  })

  test('Maintenance charges and water in row 2.2', () => {
    const data = input({
      ownership: always(5000),
      charges: { maintenance: [amount(19617)], financing: [] },
      usageCharges: [
        {
          id: 'w',
          kind: 'water',
          basis: 'per_occupant',
          description: null,
          periods: [amount(2017)],
        },
      ],
      entries: [entry('water_charge', 3600, '2025-06-15')],
    })
    expect(year(data).rows['2.2']).toEqual({
      cents: 131604,
      parts: [
        { key: 'maintenance_charge', cents: 117702 },
        { key: 'water', cents: 12102 },
        { key: 'water_charge', cents: 1800 },
      ],
    })
  })

  test('An income-recognised financing charge in row 2.3', () => {
    const data = input({
      ownership: always(5000),
      charges: {
        maintenance: [],
        financing: [
          {
            id: 'f',
            name: 'Putkiremontti',
            periods: [amount(6050, '2025-01-01')],
          },
        ],
      },
      treatments: [treatment('income_recognised', '2025-01-01')],
    })
    expect(year(data).rows['2.3'].cents).toBe(36300)
  })

  test('A treatment change during the year', () => {
    const data = input({
      ownership: always(5000),
      charges: {
        maintenance: [],
        financing: [
          {
            id: 'f',
            name: 'Putkiremontti',
            periods: [amount(6050, '2025-01-01')],
          },
        ],
      },
      treatments: [
        treatment('capitalised', '2025-01-01', '2025-06-30'),
        treatment('income_recognised', '2025-07-01'),
      ],
    })
    const result = year(data)
    expect(result.rows['2.3'].cents).toBe(18150)
    expect(result.outside.capitalised).toBe(18150)
  })

  test('Entries in rows 2.4 and 2.5', () => {
    const data = input({
      ownership: always(5000),
      entries: [
        entry('annual_repair', 134200, '2025-03-10'),
        entry('insurance', 18600, '2025-04-01'),
      ],
      usageCharges: [
        {
          id: 'p',
          kind: 'parking',
          basis: 'fixed',
          description: null,
          periods: [amount(1200)],
        },
      ],
    })
    const result = year(data)
    expect(result.rows['2.4'].cents).toBe(67100)
    expect(result.rows['2.5']).toEqual({
      cents: 16500,
      parts: [
        { key: 'insurance', cents: 9300 },
        { key: 'parking', cents: 7200 },
      ],
    })
  })

  test('The current year counts the months so far', () => {
    const data = input({
      charges: { maintenance: [amount(20000, '2026-01-01')], financing: [] },
    })
    expect(year(data, 2026, '2026-11-25').rows['2.2'].cents).toBe(220000)
  })
})

describe('Shares on the cash basis', () => {
  test('A share change during the year', () => {
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const month = `2025-${String(i + 1).padStart(2, '0')}`
      return payment(month, 75000, `${month}-03`)
    })
    const data = input({
      ownership: ownership(
        [5000, '2024-01-01', '2025-06-30'],
        [10000, '2025-07-01', null],
      ),
      payments: monthly,
      charges: { maintenance: [amount(15400)], financing: [] },
    })
    const result = year(data)
    expect(result.rows['2.1'].cents).toBe(675000)
    expect(result.rows['2.2'].parts).toEqual([
      { key: 'maintenance_charge', cents: 138600 },
    ])
  })

  test('A charge month follows its first day', () => {
    const shares = ownership(
      [5000, '2024-01-01', '2025-07-14'],
      [10000, '2025-07-15', null],
    )
    const only = (month: string) =>
      input({
        ownership: shares,
        charges: {
          maintenance: [amount(15400, `${month}-01`, `${month}-28`)],
          financing: [],
        },
      })
    expect(year(only('2025-07')).rows['2.2'].cents).toBe(7700)
    expect(year(only('2025-08')).rows['2.2'].cents).toBe(15400)
  })

  test('Rounding a part once', () => {
    const data = input({
      ownership: always(3333),
      payments: [
        payment('2025-01', 89000, '2025-01-04'),
        payment('2025-02', 89000, '2025-02-04'),
        payment('2025-03', 89000, '2025-03-04'),
      ],
    })
    expect(year(data).rows['2.1'].parts).toEqual([
      { key: 'rent_payments', cents: 88991 },
    ])
  })
})

describe('The Not on form 7H card', () => {
  test('Capitalised financing charges', () => {
    const data = input({
      ownership: always(5000),
      charges: {
        maintenance: [],
        financing: [
          { id: 'f', name: null, periods: [amount(7883, '2025-01-01')] },
        ],
      },
      treatments: [treatment('capitalised', '2025-01-01')],
    })
    const result = year(data)
    expect(result.outside.capitalised).toBe(47298)
    expect(result.rows['2.3'].cents).toBe(0)
  })

  test('An improvement is shown, not counted', () => {
    const data = input({
      ownership: always(5000),
      entries: [entry('improvement', 120000, '2025-04-02')],
    })
    const result = year(data)
    expect(result.outside.improvements).toBe(60000)
    expect(Object.values(result.rows).map((row) => row.cents)).toEqual([
      0, 0, 0, 0, 0,
    ])
  })
})

describe('The year the summary opens on', () => {
  const owned = ownership([10000, '2024-05-01', null])

  test('In spring the previous year opens', () => {
    const years = summaryYears(owned, 'annika', '2026-03-15')
    expect(years).toEqual([2024, 2025, 2026])
    expect(openingYear(years, '2026-03-15')).toBe(2025)
  })

  test('From July the current year opens', () => {
    const years = summaryYears(owned, 'annika', '2026-07-01')
    expect(openingYear(years, '2026-07-01')).toBe(2026)
  })

  test('A first share this year', () => {
    const years = summaryYears(
      ownership([10000, '2026-02-01', null]),
      'annika',
      '2026-03-15',
    )
    expect(years).toEqual([2026])
    expect(openingYear(years, '2026-03-15')).toBe(2026)
  })

  test('A year outside the range opens the nearest year', () => {
    expect(clampYear([2024, 2025, 2026], 2020)).toBe(2024)
    expect(clampYear([2024, 2025, 2026], 2031)).toBe(2026)
    expect(clampYear([], 2025)).toBe(2025)
  })
})

describe('Flats in the year summary', () => {
  test('An archived flat is included', () => {
    const data = input({ ownership: ownership([5000, '2024-03-01', null]) })
    expect(year(data).included).toBe(true)
  })

  test('A share starting during the year', () => {
    const data = input({ ownership: ownership([5000, '2025-10-01', null]) })
    expect(year(data, 2025).included).toBe(true)
    expect(year(data, 2024).included).toBe(false)
  })

  test('A share ended during the year', () => {
    const data = input({
      ownership: ownership(
        [5000, '2024-01-01', '2025-06-30'],
        [0, '2025-07-01', null],
      ),
    })
    expect(year(data, 2025).included).toBe(true)
    expect(year(data, 2026).included).toBe(false)
  })

  test('A share of 0 all year is not included', () => {
    expect(year(input({ ownership: always(0) })).included).toBe(false)
  })

  test('A share starting after today is not included', () => {
    const data = input({ ownership: ownership([5000, '2026-12-01', null]) })
    expect(year(data, 2026, '2026-11-25').included).toBe(false)
  })
})

describe('Flat details for form 7H', () => {
  test('Missing housing company details', () => {
    const data = input({
      housingCompany: { name: null, businessId: null, apartmentNumber: null },
    })
    const result = year(data)
    expect(result.details).toMatchObject({
      name: null,
      businessId: null,
      apartmentNumber: null,
    })
    expect(result.checks).toContainEqual({
      kind: 'details_missing',
      missing: ['name', 'business_id', 'apartment_number'],
    })
  })

  test('One tenancy for part of the year', () => {
    const data = input({
      tenancies: [
        tenancy({ tenantName: 'Mikko Laine', validTo: '2025-09-30' }),
      ],
    })
    expect(year(data).details).toMatchObject({
      tenant: { kind: 'one', name: 'Mikko Laine' },
      period: { from: '2025-01-01', to: '2025-09-30' },
    })
  })

  test('Several tenancies in the year', () => {
    const data = input({
      tenancies: [
        tenancy({ id: 'a', validTo: '2025-05-31' }),
        tenancy({
          id: 'b',
          tenantName: 'Mikko Laine',
          validFrom: '2025-06-15',
        }),
      ],
    })
    expect(year(data).details).toMatchObject({
      tenant: { kind: 'several' },
      period: { from: '2025-01-01', to: '2025-12-31' },
    })
  })

  test('No tenancy in the year', () => {
    const data = input({ tenancies: [tenancy({ validFrom: '2026-02-01' })] })
    expect(year(data).details).toMatchObject({
      tenant: { kind: 'none' },
      period: null,
    })
  })

  test('A tenancy starting after today is not counted in the current year', () => {
    const data = input({ tenancies: [tenancy({ validFrom: '2026-12-01' })] })
    expect(year(data, 2026, '2026-11-25').details.tenant).toEqual({
      kind: 'none',
    })
  })

  test('The share at the end of the year', () => {
    const data = input({
      ownership: ownership(
        [5000, '2024-01-01', '2025-06-30'],
        [10000, '2025-07-01', null],
      ),
    })
    expect(year(data).details.share).toBe(10000)
  })

  test("The share at the end of the user's period", () => {
    const data = input({
      ownership: ownership(
        [5000, '2024-01-01', '2025-06-30'],
        [0, '2025-07-01', null],
      ),
    })
    expect(year(data).details.share).toBe(5000)
  })
})

describe('Checks in the year summary', () => {
  const paid = rentIn2025()
  const owned = { tenancies: [tenancy()] }

  test('A month not paid', () => {
    const result = year(input({ ...owned, payments: paid }))
    expect(result.checks).toContainEqual({
      kind: 'unpaid',
      months: ['2025-12'],
    })
  })

  test('A partly paid month', () => {
    const payments = [
      ...paid.filter((p) => p.month !== '2025-11'),
      payment('2025-11', 50000, '2025-11-05'),
      payment('2025-12', 89000, '2025-12-05'),
    ]
    const result = year(input({ ...owned, payments }))
    expect(result.checks).toContainEqual({
      kind: 'partly_paid',
      months: [{ month: '2025-11', missing: 39000 }],
    })
    expect(result.checks.map((c) => c.kind)).not.toContain('unpaid')
  })

  test('Months before the user owned are not checked', () => {
    const result = year(
      input({
        ...owned,
        ownership: ownership([10000, '2025-12-01', null]),
        payments: [],
      }),
    )
    expect(result.checks).toContainEqual({
      kind: 'unpaid',
      months: ['2025-12'],
    })
  })

  test('Vacant months with charges', () => {
    const data = input({
      tenancies: [tenancy({ validTo: '2025-09-30' })],
      payments: paid.slice(0, 9),
      charges: { maintenance: [amount(24458)], financing: [] },
    })
    const result = year(data)
    expect(result.checks).toContainEqual({
      kind: 'vacant',
      months: ['2025-10', '2025-11', '2025-12'],
    })
    expect(result.rows['2.2'].cents).toBe(12 * 24458)
  })

  test('A vacant month without charges is not named', () => {
    const data = input({ tenancies: [tenancy({ validTo: '2025-09-30' })] })
    expect(year(data).checks.map((c) => c.kind)).not.toContain('vacant')
  })

  test('A financing charge without a treatment', () => {
    const data = input({
      charges: {
        maintenance: [],
        financing: [
          { id: 'f', name: null, periods: [amount(6050, '2025-01-01')] },
        ],
      },
    })
    const result = year(data)
    const check = result.checks.find((c) => c.kind === 'treatment_not_set')
    expect(check && 'months' in check ? check.months : []).toHaveLength(12)
    expect(result.rows['2.3'].cents).toBe(0)
    expect(result.outside.capitalised).toBe(0)
  })

  test('Two financing charges without a treatment count each month once', () => {
    const data = input({
      charges: {
        maintenance: [],
        financing: [
          { id: 'f1', name: null, periods: [amount(6050, '2025-01-01')] },
          {
            id: 'f2',
            name: 'Putkiremontti',
            periods: [amount(6050, '2025-01-01')],
          },
        ],
      },
    })
    const check = year(data).checks.find((c) => c.kind === 'treatment_not_set')
    expect(check && 'months' in check ? check.months : []).toHaveLength(12)
  })

  test('A share change', () => {
    const data = input({
      ownership: ownership(
        [5000, '2024-01-01', '2025-06-30'],
        [10000, '2025-07-01', null],
      ),
    })
    expect(year(data).checks).toContainEqual({
      kind: 'share_changed',
      on: '2025-07-01',
      from: 5000,
      to: 10000,
    })
  })

  test('A first share in the year is not a change', () => {
    const data = input({ ownership: ownership([5000, '2025-10-01', null]) })
    expect(year(data).checks.map((c) => c.kind)).not.toContain('share_changed')
  })
})
