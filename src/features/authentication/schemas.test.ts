import { describe, expect, test } from 'vitest'
import { codeSchema, emailSchema } from './schemas'

const issue = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message

describe('emailSchema', () => {
  test('trims and lowercases the address', () => {
    expect(emailSchema.parse('  Omistaja@Example.COM ')).toBe(
      'omistaja@example.com',
    )
  })

  test.each(['', 'mikko@esimerkki', 'ei osoite', 'a@b@c.fi', 42])(
    'rejects %j with email_invalid',
    (value) => {
      expect(issue(emailSchema.safeParse(value))).toBe('email_invalid')
    },
  )

  test('rejects an address longer than 254 characters', () => {
    const long = `${'a'.repeat(250)}@x.fi`
    expect(issue(emailSchema.safeParse(long))).toBe('email_invalid')
  })
})

describe('codeSchema', () => {
  test('accepts six digits', () => {
    expect(codeSchema.parse(' 482913 ')).toBe('482913')
  })

  test.each(['48291', '4829134', '48291a', '', null])(
    'rejects %j with code_invalid',
    (value) => {
      expect(issue(codeSchema.safeParse(value))).toBe('code_invalid')
    },
  )
})
