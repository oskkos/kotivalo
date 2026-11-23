import { describe, expect, test } from 'vitest'
import {
  accumulatedCapitalised,
  currentAndUpcoming,
  monthlyAmounts,
  nextMonth,
  validateAmountDate,
  valueInMonth,
  yearEffect,
  type Period,
} from './periods'

const maintenance: Period<number>[] = [
  { validFrom: '2025-03-01', validTo: '2025-12-31', value: 20500 },
  { validFrom: '2026-01-01', validTo: null, value: 21400 },
]

describe('Rent and charges are recorded as monthly periods', () => {
  test("A month's amount comes from the period containing its first day", () => {
    expect(valueInMonth(maintenance, '2025-12')).toBe(20500)
    expect(valueInMonth(maintenance, '2026-01')).toBe(21400)
    expect(valueInMonth(maintenance, '2025-02')).toBeUndefined()
  })

  test("A date that isn't the first of a month is refused", () => {
    expect(
      validateAmountDate('2027-03-15', {
        ownershipStart: '2025-03-01',
        latestStart: undefined,
      }),
    ).toBe('amount_date_not_month_start')
  })

  test('the months of a year, across a change in January', () => {
    expect(monthlyAmounts(maintenance, 2025)).toEqual([
      undefined,
      undefined,
      ...Array<number>(10).fill(20500),
    ])
    expect(monthlyAmounts(maintenance, 2026)).toEqual(
      Array<number>(12).fill(21400),
    )
  })

  test('a change in December applies to December only', () => {
    const rent: Period<number>[] = [
      { validFrom: '2025-03-01', validTo: '2026-11-30', value: 89000 },
      { validFrom: '2026-12-01', validTo: null, value: 92000 },
    ]
    expect(monthlyAmounts(rent, 2026).slice(10)).toEqual([89000, 92000])
  })

  test('the next month rolls over the year', () => {
    expect(nextMonth('2025-12')).toBe('2026-01')
    expect(nextMonth('2026-09')).toBe('2026-10')
  })
})

describe('the date rules for a new amount', () => {
  const limits = { ownershipStart: '2022-06-12', latestStart: '2026-01-01' }

  test('the month the ownership starts in is allowed', () => {
    expect(
      validateAmountDate('2022-06-01', { ...limits, latestStart: undefined }),
    ).toBeUndefined()
  })

  test('a month before the ownership is refused', () => {
    expect(
      validateAmountDate('2022-05-01', { ...limits, latestStart: undefined }),
    ).toBe('amount_date_before_ownership')
  })

  test('a date before the latest start is refused, the start itself is not', () => {
    expect(validateAmountDate('2025-06-01', limits)).toBe(
      'amount_date_too_early',
    )
    expect(validateAmountDate('2026-01-01', limits)).toBeUndefined()
    expect(validateAmountDate('2030-01-01', limits)).toBeUndefined()
  })
})

describe('the current and upcoming amount', () => {
  const withUpcoming: Period<number>[] = [
    { validFrom: '2026-01-01', validTo: '2026-12-31', value: 21400 },
    { validFrom: '2027-01-01', validTo: null, value: 22600 },
  ]

  test('today falls in the current period, the next one is upcoming', () => {
    expect(currentAndUpcoming(withUpcoming, '2026-11-21')).toEqual({
      current: withUpcoming[0],
      upcoming: withUpcoming[1],
    })
  })

  test('before the first period there is only an upcoming amount', () => {
    expect(currentAndUpcoming(withUpcoming, '2025-11-21')).toEqual({
      current: undefined,
      upcoming: withUpcoming[0],
    })
  })
})

describe('the effect of a change on its year', () => {
  test('a raise from January covers 12 months', () => {
    const effect = yearEffect(21400, 22600, '2027-01-01')
    expect(effect).toEqual({
      difference: 1200,
      percent: expect.closeTo(5.607, 2) as number,
      year: 2027,
      months: 12,
      total: 14400,
    })
  })

  test('a decrease from March covers 10 months', () => {
    expect(yearEffect(8600, 8000, '2026-03-01')).toMatchObject({
      difference: -600,
      months: 10,
      total: -6000,
    })
  })

  test('there is no percentage from zero', () => {
    expect(yearEffect(0, 5000, '2026-01-01').percent).toBeUndefined()
  })
})

describe('Accumulated capitalised financing charges', () => {
  const financing = [
    {
      periods: [
        { validFrom: '2025-03-01', validTo: '2025-12-31', value: 8000 },
        { validFrom: '2026-01-01', validTo: null, value: 8600 },
      ] satisfies Period<number>[],
    },
  ]

  test('Only capitalised months count', () => {
    expect(
      accumulatedCapitalised(
        financing,
        [
          {
            validFrom: '2025-03-01',
            validTo: '2026-06-30',
            value: 'capitalised',
          },
          {
            validFrom: '2026-07-01',
            validTo: null,
            value: 'income_recognised',
          },
        ],
        '2026-11-21',
      ),
    ).toBe(10 * 8000 + 6 * 8600)
  })

  test("Months without a treatment don't count", () => {
    expect(accumulatedCapitalised(financing, [], '2026-11-21')).toBe(0)
  })

  test('the current month counts, future months do not', () => {
    expect(
      accumulatedCapitalised(
        financing,
        [{ validFrom: '2025-03-01', validTo: null, value: 'capitalised' }],
        '2025-04-30',
      ),
    ).toBe(2 * 8000)
  })

  test('no financing charge means nothing accumulated', () => {
    expect(accumulatedCapitalised([], [], '2026-11-21')).toBe(0)
  })

  test('All financing charges count', () => {
    const p = (validFrom: string, validTo: string | null, value: number) => ({
      validFrom,
      validTo,
      value,
    })
    expect(
      accumulatedCapitalised(
        [
          { periods: [p('2025-03-01', null, 8600)] },
          { periods: [p('2026-01-01', null, 4200)] },
          {
            periods: [
              p('2025-03-01', '2025-12-31', 2400),
              p('2026-01-01', null, 0),
            ],
          },
        ],
        [{ validFrom: '2025-03-01', validTo: null, value: 'capitalised' }],
        '2026-11-23',
      ),
    ).toBe(21 * 8600 + 11 * 4200 + 10 * 2400)
  })
})
