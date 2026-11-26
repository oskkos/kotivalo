import { describe, expect, test } from 'vitest'
import {
  addMonths,
  addYears,
  addDays,
  dayBefore,
  daysBetween,
  daysInMonth,
  lastDayOfMonth,
  isoDateInFinland,
  parseFiDate,
} from './dates'

describe('parseFiDate', () => {
  test.each([
    ['12.6.2022', '2022-06-12'],
    ['01.03.2025', '2025-03-01'],
    [' 29.2.2024 ', '2024-02-29'],
    ['2022-06-12', '2022-06-12'],
    ['12/06/2022', '2022-06-12'],
  ])('reads %s as %s', (text, iso) => {
    expect(parseFiDate(text)).toBe(iso)
  })

  test.each([
    '',
    '12.6.22',
    '31.2.2026',
    '29.2.2025',
    '2022-6-12',
    '12/6/22',
    'eilen',
  ])('rejects %j', (text) => {
    expect(parseFiDate(text)).toBeUndefined()
  })
})

describe('isoDateInFinland', () => {
  test('uses Finnish time, not UTC', () => {
    // 22.30 UTC on 19 November is 00.30 on the 20th in Finland.
    expect(isoDateInFinland(new Date(Date.UTC(2026, 10, 19, 22, 30)))).toBe(
      '2026-11-20',
    )
  })
})

describe('dayBefore', () => {
  test.each([
    ['2025-03-01', '2025-02-28'],
    ['2024-03-01', '2024-02-29'],
    ['2026-01-01', '2025-12-31'],
  ])('the day before %s is %s', (date, before) => {
    expect(dayBefore(date)).toBe(before)
  })
})

describe('month and year arithmetic', () => {
  test.each([
    ['2027-02', '2027-02-28'],
    ['2028-02', '2028-02-29'],
    ['2026-12', '2026-12-31'],
    ['2027-04', '2027-04-30'],
  ])('the last day of %s is %s', (month, last) => {
    expect(lastDayOfMonth(month)).toBe(last)
  })

  test.each([
    ['2026-11', 1, '2026-12'],
    ['2026-11', 6, '2027-05'],
    ['2026-11', 14, '2028-01'],
    ['2027-01', -1, '2026-12'],
  ])('%s moved by %i months is %s', (month, months, moved) => {
    expect(addMonths(month, months)).toBe(moved)
  })

  test.each([
    ['2025-03-01', 1, '2026-03-01'],
    ['2024-02-29', 1, '2025-02-28'],
    ['2024-02-29', 4, '2028-02-29'],
    ['2026-10-31', 2, '2028-10-31'],
  ])('%s moved by %i years is %s', (date, years, moved) => {
    expect(addYears(date, years)).toBe(moved)
  })
})

describe('day counts', () => {
  test('days in a month, also in a leap year', () => {
    expect(daysInMonth('2026-11')).toBe(30)
    expect(daysInMonth('2027-01')).toBe(31)
    expect(daysInMonth('2027-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
  })

  test('days between two dates, across months and years', () => {
    expect(daysBetween('2026-11-05', '2026-11-22')).toBe(17)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
    expect(daysBetween('2026-11-22', '2026-11-05')).toBe(-17)
  })
})

describe('addDays', () => {
  test.each([
    ['2026-12-31', 14, '2027-01-14'],
    ['2028-02-20', 10, '2028-03-01'],
    ['2026-03-01', -1, '2026-02-28'],
  ])('%s plus %i days is %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected)
  })
})
