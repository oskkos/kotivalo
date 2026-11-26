import { describe, expect, test } from 'vitest'
import { personChoice, urlPerson, urlYear } from './schemas'

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

describe('Choosing whose figures', () => {
  test('A person in the URL is a user id or the whole flats', () => {
    expect(urlPerson.parse('whole')).toBe('whole')
    expect(urlPerson.parse('user-123')).toBe('user-123')
    expect(urlPerson.parse(undefined)).toBeUndefined()
  })

  test('Anything else in the URL is left out', () => {
    expect(urlPerson.parse('')).toBeUndefined()
    expect(urlPerson.parse('x'.repeat(65))).toBeUndefined()
    expect(urlPerson.parse(5)).toBeUndefined()
    expect(urlPerson.parse(['a'])).toBeUndefined()
    expect(personChoice.safeParse('').success).toBe(false)
  })
})
