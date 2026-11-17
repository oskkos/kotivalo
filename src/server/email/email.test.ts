import { describe, expect, test } from 'vitest'
import { assertValidMessage, EmailError, type EmailMessage } from './email'

const message: EmailMessage = {
  to: 'owner@example.com',
  subject: 'Hello',
  text: 'Body',
  html: '<p>Body</p>',
}

describe('assertValidMessage', () => {
  test('accepts a message with one recipient', () => {
    expect(() => {
      assertValidMessage(message)
    }).not.toThrow()
  })

  test.each([
    '',
    'owner',
    'a@example.com, b@example.com',
    'a@example.com;b@example.com',
    'Owner <owner@example.com>',
    'owner@example.com\nBcc: x@example.com',
  ])('rejects the recipient %j', (to) => {
    expect(() => {
      assertValidMessage({ ...message, to })
    }).toThrow(EmailError)
  })

  test.each(['', '  ', 'Hi\r\nBcc: x@example.com'])(
    'rejects the subject %j',
    (subject) => {
      expect(() => {
        assertValidMessage({ ...message, subject })
      }).toThrow(EmailError)
    },
  )

  test('rejects an empty plain-text body', () => {
    expect(() => {
      assertValidMessage({ ...message, text: ' ' })
    }).toThrow(EmailError)
  })

  test('marks invalid messages as rejected', () => {
    expect(() => {
      assertValidMessage({ ...message, to: '' })
    }).toThrow(expect.objectContaining({ failure: 'rejected' }))
  })
})
