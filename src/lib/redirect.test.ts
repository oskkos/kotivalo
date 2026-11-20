import { describe, expect, test } from 'vitest'
import { safeRedirect } from './redirect'

describe('safeRedirect', () => {
  test.each(['/', '/properties/new', '/properties/abc/edit?tab=1#top'])(
    'keeps the path %s',
    (target) => {
      expect(safeRedirect(target)).toBe(target)
    },
  )

  test.each([
    undefined,
    42,
    '',
    'properties/new',
    'https://evil.example/',
    '//evil.example/',
    '/\\evil.example/',
    '/\t/evil.example/',
    '/\n/evil.example/',
    'javascript:alert(1)',
    '/welcome',
    '/welcome?redirect=%2F',
  ])('sends %j to /', (target) => {
    expect(safeRedirect(target)).toBe('/')
  })
})
