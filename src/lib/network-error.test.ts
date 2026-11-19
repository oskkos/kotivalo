import { describe, expect, test } from 'vitest'
import { failureReason, isNetworkError } from './network-error'

describe('isNetworkError', () => {
  test.each([
    ['Chromium', new TypeError('Failed to fetch')],
    [
      'Firefox',
      new TypeError('NetworkError when attempting to fetch resource.'),
    ],
    ['Safari', new TypeError('Load failed')],
    ['a cancelled request', new DOMException('aborted', 'AbortError')],
  ])('recognises %s', (_browser, error) => {
    expect(isNetworkError(error)).toBe(true)
  })

  test.each([
    ['another TypeError', new TypeError('Cannot read properties of undefined')],
    ['an Error with the same text', new Error('Failed to fetch')],
    ['a string', 'Failed to fetch'],
  ])('leaves out %s', (_name, error) => {
    expect(isNetworkError(error)).toBe(false)
  })
})

describe('failureReason', () => {
  test('is network for a connection failure, unexpected otherwise', () => {
    expect(failureReason(new TypeError('Failed to fetch'))).toBe('network')
    expect(failureReason(new Error('500'))).toBe('unexpected')
  })
})
