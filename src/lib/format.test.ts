import { describe, expect, test } from 'vitest'
import { areaCases, dateCases, moneyCases } from './format.cases'
import { formatArea, formatDate, formatMoney } from './format'

describe('formatMoney', () => {
  test.each(moneyCases)('%s: %i cents is %s', (locale, cents, expected) => {
    expect(formatMoney(cents, locale)).toBe(expected)
  })

  test('uses the base locale, Finnish, outside a request', () => {
    expect(formatMoney(123456)).toBe(formatMoney(123456, 'fi'))
  })

  test('rejects amounts that are not integer cents', () => {
    expect(() => formatMoney(12.5, 'fi')).toThrow(RangeError)
  })
})

describe('formatDate', () => {
  test.each(dateCases)('%s: %s is %s', (locale, iso, expected) => {
    expect(formatDate(iso, locale)).toBe(expected)
  })

  test('does not shift the day in a time zone west of UTC', () => {
    // Node reads TZ when formatting; the helper formats in UTC regardless.
    const tz = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      expect(formatDate('2026-01-01', 'fi')).toBe('1.1.2026')
    } finally {
      if (tz === undefined) {
        delete process.env.TZ
      } else {
        process.env.TZ = tz
      }
    }
  })

  test.each(['2026-02-30', '2026-3-5', '05.03.2026', ''])(
    'rejects %j',
    (iso) => {
      expect(() => formatDate(iso, 'fi')).toThrow(RangeError)
    },
  )
})

describe('formatArea', () => {
  test.each(areaCases)(
    '%s: %i tenths of m² is %s',
    (locale, tenths, expected) => {
      expect(formatArea(tenths, locale)).toBe(expected)
    },
  )

  test('rejects areas that are not integer tenths', () => {
    expect(() => formatArea(48.5, 'fi')).toThrow(RangeError)
  })
})
