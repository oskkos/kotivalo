import { describe, expect, test } from 'vitest'
import { codeSchema, displayNameSchema, emailSchema } from './schemas'

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

describe('displayNameSchema', () => {
  test('trims the name', () => {
    expect(displayNameSchema.parse('  Annika ')).toBe('Annika')
  })

  test.each(['', '   ', 42])('rejects %j with name_required', (value) => {
    expect(issue(displayNameSchema.safeParse(value))).toBe('name_required')
  })

  test('accepts 50 characters and rejects 51 with name_too_long', () => {
    expect(displayNameSchema.parse('a'.repeat(50))).toHaveLength(50)
    expect(issue(displayNameSchema.safeParse('a'.repeat(51)))).toBe(
      'name_too_long',
    )
  })
})

describe('Asking for a display name', () => {
  test('A name with an address or a link is not saved', () => {
    for (const value of [
      'anna@example.com',
      'https://huijaus.fi',
      'Anna <b>',
      'a/b',
      'Verottaja www.vero-palautus.example',
      'pankki.fi',
      'Anna\nVirtanen',
      'Anna\tVirtanen',
    ]) {
      expect(issue(displayNameSchema.safeParse(value))).toBe('name_invalid')
    }
    expect(displayNameSchema.parse('A. Virtanen')).toBe('A. Virtanen')
  })
})
