import { describe, expect, test } from 'vitest'
import { amountForCopy, shareForCopy } from './copy'

describe('Copying form 7H values', () => {
  test('Amounts and shares in the copy format', () => {
    expect(amountForCopy(30250)).toBe('302,50')
    expect(amountForCopy(0)).toBe('0,00')
    expect(shareForCopy(5000)).toBe('50')
    expect(shareForCopy(3333)).toBe('33,33')
  })

  test('An amount has no spaces or thousand separators', () => {
    expect(amountForCopy(489500)).toBe('4895,00')
    expect(amountForCopy(123456789)).toBe('1234567,89')
    expect(amountForCopy(5)).toBe('0,05')
  })

  test('A share keeps a decimal comma only when needed', () => {
    expect(shareForCopy(10000)).toBe('100')
    expect(shareForCopy(5050)).toBe('50,5')
    expect(shareForCopy(1)).toBe('0,01')
  })
})
