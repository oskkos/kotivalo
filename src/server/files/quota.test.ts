import { describe, expect, test } from 'vitest'
import { fitsQuota, STORAGE_QUOTA } from './quota'

describe('the storage quota', () => {
  test('the 1,000th file fits, the 1,001st does not', () => {
    expect(fitsQuota({ bytes: 0, files: 999 }, 1)).toBe(true)
    expect(fitsQuota({ bytes: 0, files: 1000 }, 1)).toBe(false)
  })

  test('exactly 500 MB fits, a byte more does not', () => {
    expect(fitsQuota({ bytes: STORAGE_QUOTA.bytes - 100, files: 0 }, 100)).toBe(
      true,
    )
    expect(fitsQuota({ bytes: STORAGE_QUOTA.bytes - 100, files: 0 }, 101)).toBe(
      false,
    )
  })
})
