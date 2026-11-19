// The same expectations in the Workers runtime, whose ICU data is workerd's,
// not Node's (en-FI support was an open question in CONCEPT.md §6).
import { describe, expect, test } from 'vitest'
import { areaCases, dateCases, moneyCases } from './format.cases'
import { formatArea, formatDate, formatMoney } from './format'

describe('Formatting on Workers', () => {
  test.each(moneyCases)('%s: %i cents is %s', (locale, cents, expected) => {
    expect(formatMoney(cents, locale)).toBe(expected)
  })

  test.each(dateCases)('%s: %s is %s', (locale, iso, expected) => {
    expect(formatDate(iso, locale)).toBe(expected)
  })

  test.each(areaCases)(
    '%s: %i tenths of m² is %s',
    (locale, tenths, expected) => {
      expect(formatArea(tenths, locale)).toBe(expected)
    },
  )
})
