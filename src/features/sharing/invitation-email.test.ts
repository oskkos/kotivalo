import { describe, expect, test } from 'vitest'
import { invitationEmail } from './invitation-email'

const options = {
  to: 'jussi@example.com',
  inviterName: 'Annika',
  inviterEmail: 'anna@example.com',
  appUrl: 'https://kotivalo.example',
  invitationId: 'i1',
} as const

describe('invitationEmail', () => {
  test('names the inviter and the address, links to the app', () => {
    const email = invitationEmail({ ...options, locale: 'fi' })

    expect(email.to).toBe('jussi@example.com')
    expect(email.subject).toBe('Sinut on kutsuttu asuntoon Kotivalossa')
    expect(email.text).toContain(
      'Annika (anna@example.com) jakoi sinulle asunnon Kotivalossa',
    )
    expect(email.text).toContain(
      'Kirjaudu osoitteella jussi@example.com, niin näet kutsun',
    )
    expect(email.text).toContain('Kutsu on voimassa 30 päivää.')
    expect(email.text).toContain('Avaa Kotivalo: https://kotivalo.example')
    expect(email.html).toContain('href="https://kotivalo.example"')
    expect(email.idempotencyKey).toBe('invitation-i1')
  })

  test('escapes the inviter name in the HTML', () => {
    const email = invitationEmail({
      ...options,
      inviterName: '<b>Annika</b>',
      locale: 'fi',
    })
    expect(email.html).not.toContain('<b>Annika</b>')
    expect(email.html).toContain('&lt;b&gt;Annika&lt;/b&gt;')
  })

  test.each([
    ['sv', 'Du har bjudits in till en bostad i Kotivalo', 'Öppna Kotivalo'],
    ['en', "You're invited to a flat in Kotivalo", 'Open Kotivalo'],
  ] as const)('is written in %s', (locale, subject, action) => {
    const email = invitationEmail({ ...options, locale })
    expect(email.subject).toBe(subject)
    expect(email.text).toContain(action)
    expect(email.html).toContain(`<html lang="${locale}">`)
  })
})
