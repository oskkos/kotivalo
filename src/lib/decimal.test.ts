import { describe, expect, test } from 'vitest'
import { parseDecimal } from './decimal'

describe('parseDecimal', () => {
  test.each([
    ['48,5', 485],
    ['48.5', 485],
    ['48', 480],
    ['48,', 480],
    [' 1 200,5 ', 12005],
    ['1\u00a0200', 12000],
    ['0', 0],
  ])('reads %j as %i tenths', (text, expected) => {
    expect(parseDecimal(text, 1)).toBe(expected)
  })

  test.each(['', 'abc', '48,55', '-5', '4,8,5', '1e3', ',5'])(
    'refuses %j',
    (text) => {
      expect(parseDecimal(text, 1)).toBeUndefined()
    },
  )

  test('scales by the given number of decimals', () => {
    expect(parseDecimal('12,34', 2)).toBe(1234)
    expect(parseDecimal('12', 0)).toBe(12)
    expect(parseDecimal('12,3', 0)).toBeUndefined()
  })
})
