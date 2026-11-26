import { describe, expect, test } from 'vitest'
import { urlYear } from './schemas'

describe('The year the summary opens on', () => {
  test('A year outside the range in the URL opens the nearest year', () => {
    expect(urlYear.parse(1999)).toBe(2000)
    expect(urlYear.parse(3000)).toBe(2100)
    expect(urlYear.parse(2025)).toBe(2025)
    expect(urlYear.parse('kaksi')).toBeUndefined()
    expect(urlYear.parse(2025.5)).toBeUndefined()
    expect(urlYear.parse(undefined)).toBeUndefined()
  })
})
