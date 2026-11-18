import { describe, expect, test } from 'vitest'
import { signInCodeEmail } from './sign-in-email'

describe('signInCodeEmail', () => {
  test('puts the code in the subject and the body', () => {
    const email = signInCodeEmail({
      to: 'uusi@example.com',
      code: '482913',
      locale: 'fi',
    })
    expect(email.to).toBe('uusi@example.com')
    expect(email.subject).toBe('482913 on Kotivalo-kirjautumiskoodisi')
    expect(email.text).toContain('\n\n482913\n\n')
    expect(email.text).toContain('Koodi on voimassa 10 minuuttia.')
    expect(email.html).toContain('>482913</p>')
  })

  test.each([
    [
      'sv',
      '482913 är din inloggningskod för Kotivalo',
      'Koden gäller i 10 minuter.',
    ],
    [
      'en',
      '482913 is your Kotivalo sign-in code',
      'The code is valid for 10 minutes.',
    ],
  ] as const)('is written in %s', (locale, subject, validity) => {
    const email = signInCodeEmail({
      to: 'a@example.com',
      code: '482913',
      locale,
    })
    expect(email.subject).toBe(subject)
    expect(email.text).toContain(validity)
    expect(email.html).toContain(`<html lang="${locale}">`)
  })
})
