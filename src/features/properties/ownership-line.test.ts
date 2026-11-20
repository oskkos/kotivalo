import { describe, expect, test } from 'vitest'
import { ownershipLine } from './ownership-line'

// Outside a request, messages and numbers are Finnish.
describe('ownershipLine', () => {
  test('lists the owners by share, the user as "Sinä"', () => {
    expect(
      ownershipLine([
        { name: 'Jussi', share: 3000, isYou: false },
        { name: 'Annika', share: 7000, isYou: true },
      ]),
    ).toBe('Sinä 70 % · Jussi 30 %')
  })

  test('puts the user first among equal shares', () => {
    expect(
      ownershipLine([
        { name: 'Jussi', share: 5000, isYou: false },
        { name: 'Annika', share: 5000, isYou: true },
      ]),
    ).toBe('Sinä 50 % · Jussi 50 %')
  })

  test('says that a flat is shared with a member', () => {
    expect(
      ownershipLine([{ name: 'Annika', share: 10000, isYou: false }]),
    ).toBe('Annika 100 % · jaettu sinulle')
  })

  test('is empty without owners', () => {
    expect(ownershipLine([])).toBe('')
  })
})
