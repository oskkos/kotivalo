import { describe, expect, test } from 'vitest'
import { validateTransactionDate } from './rules'

const limits = { today: '2026-11-21', ownershipStart: '2025-03-01' }

describe('Logging an entry', () => {
  test('A future date is refused', () => {
    expect(validateTransactionDate('2026-11-22', limits)).toBe(
      'transaction_date_in_future',
    )
  })

  test('A date before the ownership is refused', () => {
    expect(validateTransactionDate('2025-02-28', limits)).toBe(
      'transaction_date_before_ownership',
    )
  })
})

describe('entry dates', () => {
  test('today and the ownership start are allowed', () => {
    expect(validateTransactionDate('2026-11-21', limits)).toBeUndefined()
    expect(validateTransactionDate('2025-03-01', limits)).toBeUndefined()
  })
})
