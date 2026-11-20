import { describe, expect, test } from 'vitest'
import { dayBefore, isoDateInFinland, parseFiDate } from './dates'

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
