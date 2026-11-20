import { describe, expect, test } from 'vitest'
import {
  equalSplit,
  groupPeriods,
  parsePercent,
  sharesOn,
  validateChangeDate,
  validateFirstDate,
  validateSplit,
  type PeriodRow,
} from './periods'

// Annika owned the flat alone from 12 June 2022 and sold half to Jussi on
// 1 March 2025.
const rows: PeriodRow[] = [
  {
    userId: 'annika',
    share: 10000,
    validFrom: '2022-06-12',
    validTo: '2025-02-28',
    reason: null,
  },
  {
    userId: 'jussi',
    share: 5000,
    validFrom: '2025-03-01',
    validTo: null,
    reason: 'sale',
  },
  {
    userId: 'annika',
    share: 5000,
    validFrom: '2025-03-01',
    validTo: null,
    reason: 'sale',
  },
]

describe('Ownership is recorded as periods', () => {
  test('The shares on a date come from the period containing it', () => {
    const periods = groupPeriods(rows)

    expect(sharesOn(periods, '2025-02-28')).toEqual([
      { userId: 'annika', share: 10000 },
    ])
    expect(sharesOn(periods, '2025-03-01')).toEqual([
      { userId: 'jussi', share: 5000 },
      { userId: 'annika', share: 5000 },
    ])
    expect(sharesOn(periods, '2022-06-11')).toEqual([])
  })

  test("Shares that don't add up to 100 % are refused", () => {
    expect(
      validateSplit([
        { userId: 'annika', share: 5000 },
        { userId: 'jussi', share: 4999 },
      ]),
    ).toBe('ownership_shares_total')
  })
})

describe('groupPeriods', () => {
  test('groups rows by start date, newest first', () => {
    expect(groupPeriods(rows)).toEqual([
      {
        validFrom: '2025-03-01',
        validTo: null,
        reason: 'sale',
        shares: [
          { userId: 'jussi', share: 5000 },
          { userId: 'annika', share: 5000 },
        ],
      },
      {
        validFrom: '2022-06-12',
        validTo: '2025-02-28',
        reason: null,
        shares: [{ userId: 'annika', share: 10000 }],
      },
    ])
  })
})

describe('validateSplit', () => {
  test('accepts a split of exactly 100 %', () => {
    expect(
      validateSplit([
        { userId: 'a', share: 3334 },
        { userId: 'b', share: 3333 },
        { userId: 'c', share: 3333 },
      ]),
    ).toBeUndefined()
    expect(
      validateSplit([
        { userId: 'a', share: 10000 },
        { userId: 'b', share: 0 },
      ]),
    ).toBeUndefined()
  })

  test.each([
    [[{ userId: 'a', share: 0 }], 'ownership_no_owner'],
    [[{ userId: 'a', share: 10001 }], 'ownership_share_invalid'],
    [[{ userId: 'a', share: -1 }], 'ownership_share_invalid'],
    [[{ userId: 'a', share: 50.5 }], 'ownership_share_invalid'],
    [
      [
        { userId: 'a', share: 5000 },
        { userId: 'a', share: 5000 },
      ],
      'ownership_invalid',
    ],
  ] as const)('refuses %j with %s', (entries, problem) => {
    expect(validateSplit(entries)).toBe(problem)
  })
})

describe('validateChangeDate', () => {
  const today = '2026-11-20'

  test('accepts the current start (a correction), later days and today', () => {
    expect(
      validateChangeDate('2025-03-01', '2025-03-01', today),
    ).toBeUndefined()
    expect(
      validateChangeDate('2025-03-02', '2025-03-01', today),
    ).toBeUndefined()
    expect(validateChangeDate(today, '2025-03-01', today)).toBeUndefined()
  })

  test('refuses a day before the current start, and tomorrow', () => {
    expect(validateChangeDate('2025-02-01', '2025-03-01', today)).toBe(
      'ownership_date_too_early',
    )
    expect(validateChangeDate('2026-11-21', '2025-03-01', today)).toBe(
      'ownership_date_in_future',
    )
  })
})

describe('validateFirstDate', () => {
  const today = '2026-11-20'

  test('accepts a date before the next change, or any past date without one', () => {
    expect(validateFirstDate('2022-06-12', '2025-03-01', today)).toBeUndefined()
    expect(validateFirstDate('2025-02-28', '2025-03-01', today)).toBeUndefined()
    expect(validateFirstDate(today, undefined, today)).toBeUndefined()
  })

  test('refuses the next change or later, and the future', () => {
    expect(validateFirstDate('2025-03-01', '2025-03-01', today)).toBe(
      'ownership_date_too_late',
    )
    expect(validateFirstDate('2026-11-21', undefined, today)).toBe(
      'ownership_date_in_future',
    )
  })
})

describe('parsePercent', () => {
  test.each([
    ['50', 5000],
    ['33,33', 3333],
    ['33.34', 3334],
    ['100', 10000],
    ['0', 0],
    ['12,5 %', 1250],
  ])('reads %s as %i', (text, bp) => {
    expect(parsePercent(text)).toBe(bp)
  })

  test.each(['', 'puolet', '33,333', '101', '-5'])('rejects %j', (text) => {
    expect(parsePercent(text)).toBeUndefined()
  })
})

describe('equalSplit', () => {
  test('gives the remainder to the first person', () => {
    expect(equalSplit(['a', 'b', 'c'])).toEqual([
      { userId: 'a', share: 3334 },
      { userId: 'b', share: 3333 },
      { userId: 'c', share: 3333 },
    ])
    expect(equalSplit(['a', 'b'])).toEqual([
      { userId: 'a', share: 5000 },
      { userId: 'b', share: 5000 },
    ])
  })
})
