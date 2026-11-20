import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  chosenLocale,
  forgetChosenLocale,
  rememberChosenLocale,
} from './chosen-locale'

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('chosen sign-in language', () => {
  test('is remembered and forgotten', () => {
    expect(chosenLocale()).toBeUndefined()
    rememberChosenLocale('sv')
    expect(chosenLocale()).toBe('sv')
    forgetChosenLocale()
    expect(chosenLocale()).toBeUndefined()
  })

  test('ignores a value that is not a language', () => {
    sessionStorage.setItem('kotivalo_locale_chosen', 'de')
    expect(chosenLocale()).toBeUndefined()
  })

  test('works without sessionStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => {
      rememberChosenLocale('sv')
    }).not.toThrow()
    expect(chosenLocale()).toBeUndefined()
  })
})
