import { describe, expect, test } from 'vitest'
import { areaCases, dateCases, moneyCases } from './format.cases'
import {
  formatList,
  formatAmountInput,
  formatArea,
  formatDate,
  formatDay,
  formatDayMonth,
  formatFileSize,
  formatMoney,
  formatMoneyChange,
  formatMonth,
  formatMonthName,
  formatPercentChange,
  formatPercentNumber,
  formatShare,
} from './format'

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

describe('formatDay', () => {
  test('formats the day in Finnish time', () => {
    // 23.30 UTC on 19 November is already the 20th in Finland.
    const instant = new Date(Date.UTC(2026, 10, 19, 23, 30))
    expect(formatDay(instant, 'fi')).toBe('20.11.2026')
    expect(formatDay(instant, 'sv')).toBe('20.11.2026')
    expect(formatDay(instant, 'en')).toBe('20/11/2026')
  })
})

describe('formatShare', () => {
  test.each([
    ['fi', 5000, '50\u00a0%'],
    ['fi', 3333, '33,33\u00a0%'],
    ['fi', 10000, '100\u00a0%'],
    ['sv', 3334, '33,34\u00a0%'],
    ['en', 5000, '50%'],
    ['en', 3333, '33.33%'],
  ] as const)('%s: %i basis points is %s', (locale, bp, expected) => {
    expect(formatShare(bp, locale)).toBe(expected)
  })
})

describe('formatPercentNumber', () => {
  test.each([
    ['fi', 5000, '50'],
    ['fi', 3333, '33,33'],
    ['en', 3334, '33.34'],
    ['sv', 1250, '12,5'],
  ] as const)('%s: %i basis points is %s', (locale, bp, expected) => {
    expect(formatPercentNumber(bp, locale)).toBe(expected)
  })
})

describe('formatMoneyChange', () => {
  test.each([
    ['fi', 1200, '+12,00\u00a0€'],
    ['fi', -600, '−6,00\u00a0€'],
    ['en', 1200, '+€12.00'],
    ['sv', 0, '0,00\u00a0€'],
  ] as const)('%s: %i cents is %s', (locale, cents, expected) => {
    expect(formatMoneyChange(cents, locale)).toBe(expected)
  })
})

describe('formatPercentChange', () => {
  test.each([
    ['fi', 5.607, '+5,6\u00a0%'],
    ['en', 5.607, '+5.6%'],
    ['sv', -6.98, '−7\u00a0%'],
  ] as const)('%s: %d is %s', (locale, percent, expected) => {
    expect(formatPercentChange(percent, locale)).toBe(expected)
  })
})

describe('formatMonth', () => {
  test('a month heading starts with a capital letter', () => {
    expect(formatMonth(2026, 11, 'fi')).toBe('Marraskuu 2026')
    expect(formatMonth(2026, 11, 'sv')).toBe('November 2026')
    expect(formatMonth(2026, 1, 'en')).toBe('January 2026')
  })
})

describe('formatMonthName', () => {
  test("a month's name alone, with a capital letter", () => {
    expect(formatMonthName('2026-11', 'fi')).toBe('Marraskuu')
    expect(formatMonthName('2026-11', 'sv')).toBe('November')
    expect(formatMonthName('2027-01', 'en')).toBe('January')
  })
})

describe('formatDayMonth', () => {
  test('a date without its year', () => {
    expect(formatDayMonth('2026-11-12', 'fi')).toBe('12.11.')
    expect(formatDayMonth('2026-11-03', 'sv')).toBe('3.11')
    expect(formatDayMonth('2026-11-12', 'en')).toBe('12/11')
  })

  test('a malformed date throws', () => {
    expect(() => formatDayMonth('2026-02-30', 'fi')).toThrow(RangeError)
  })
})

describe('formatFileSize', () => {
  test('kilobytes under a megabyte, megabytes above', () => {
    expect(formatFileSize(421_888, 'fi')).toBe('412 kt')
    expect(formatFileSize(2_411_725, 'fi')).toBe('2,3 Mt')
    expect(formatFileSize(421_888, 'sv')).toBe('412 kB')
    expect(formatFileSize(2_411_725, 'en')).toBe('2.3 MB')
    expect(formatFileSize(100, 'en')).toBe('1 kB')
  })
})

describe('formatAmountInput', () => {
  test('an amount to edit, without grouping', () => {
    expect(formatAmountInput(123450, 'fi')).toBe('1234,50')
    expect(formatAmountInput(14550, 'en')).toBe('145.50')
  })
})

describe('formatList', () => {
  test('lists items as each language writes a sentence', () => {
    expect(formatList(['tammikuu', 'helmikuu', 'maaliskuu'], 'fi')).toBe(
      'tammikuu, helmikuu ja maaliskuu',
    )
    expect(formatList(['januari', 'februari'], 'sv')).toBe(
      'januari och februari',
    )
    expect(formatList(['January', 'February'], 'en')).toBe(
      'January and February',
    )
    expect(formatList(['Kuusikuja 3 B 12'], 'fi')).toBe('Kuusikuja 3 B 12')
  })
})
