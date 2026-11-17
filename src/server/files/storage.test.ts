import { describe, expect, test } from 'vitest'
import { newFileKey } from './storage'

describe('newFileKey', () => {
  test('puts the file under its kind with a random UUID', () => {
    expect(newFileKey('receipts')).toMatch(
      /^receipts\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  test('never repeats a key', () => {
    expect(newFileKey('attachments')).not.toBe(newFileKey('attachments'))
  })
})
