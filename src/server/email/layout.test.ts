import { describe, expect, test } from 'vitest'
import { escapeHtml, renderEmail, type EmailContent } from './layout'

const content: EmailContent = {
  to: 'owner@example.com',
  locale: 'fi',
  subject: 'Kirjaudu Kotivaloon',
  heading: 'Kirjaudu sisään',
  paragraphs: ['Linkki on voimassa 15 minuuttia.'],
  action: {
    label: 'Kirjaudu',
    url: 'https://kotivalo.example/auth?token=a&b=1',
  },
}

describe('renderEmail', () => {
  test('writes the plain-text body with the link', () => {
    const { text } = renderEmail(content)
    expect(text).toContain('Kirjaudu sisään')
    expect(text).toContain('Linkki on voimassa 15 minuuttia.')
    expect(text).toContain(
      'Kirjaudu: https://kotivalo.example/auth?token=a&b=1',
    )
  })

  test('writes the HTML in the recipient language', () => {
    const { html } = renderEmail(content)
    expect(html).toContain('<html lang="fi">')
    expect(html).toContain(
      'href="https://kotivalo.example/auth?token=a&amp;b=1"',
    )
  })

  test.each([
    ['fi', 'Jos painike ei toimi', 'Valoa vuokranantajan arkeen'],
    ['sv', 'Om knappen inte fungerar', 'Ljus i hyresvärdens vardag'],
    [
      'en',
      "If the button doesn't work",
      "Light for a landlord's everyday work",
    ],
  ] as const)(
    'uses the %s messages for the shared parts',
    (locale, fallback, tagline) => {
      const { html, text } = renderEmail({ ...content, locale })
      expect(html).toContain(escapeHtml(fallback))
      expect(text).toContain(tagline)
    },
  )

  test('escapes text in the HTML', () => {
    const { html } = renderEmail({
      ...content,
      heading: '<script>alert(1)</script>',
      paragraphs: ['"quoted" & <b>bold</b>'],
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&quot;quoted&quot; &amp; &lt;b&gt;bold&lt;/b&gt;')
  })

  test('renders without a button', () => {
    const { html, text } = renderEmail({ ...content, action: undefined })
    expect(html).not.toContain('<a ')
    expect(text).not.toContain('https://')
  })

  test.each(['javascript:alert(1)', 'data:text/html,hi', 'not a url'])(
    'refuses the link %j',
    (url) => {
      expect(() =>
        renderEmail({ ...content, action: { label: 'x', url } }),
      ).toThrow()
    },
  )

  test('passes the subject, recipient and idempotency key through', () => {
    expect(
      renderEmail({ ...content, idempotencyKey: 'invite-1' }),
    ).toMatchObject({
      to: 'owner@example.com',
      subject: 'Kirjaudu Kotivaloon',
      idempotencyKey: 'invite-1',
    })
  })
})

describe('renderEmail codes', () => {
  const withCode: EmailContent = {
    to: 'owner@example.com',
    locale: 'fi',
    subject: '482913 on Kotivalo-kirjautumiskoodisi',
    heading: 'Kirjautumiskoodisi',
    paragraphs: ['Syötä tämä koodi:', { code: '482913' }, 'Voimassa 10 min.'],
  }

  test('puts the code on its own line in the text, between the paragraphs', () => {
    expect(renderEmail(withCode).text).toContain(
      'Syötä tämä koodi:\n\n482913\n\nVoimassa 10 min.',
    )
  })

  test('shows the code large in the HTML', () => {
    const { html } = renderEmail(withCode)
    expect(html).toMatch(/font-size:40px[^>]*>482913<\/p>/)
  })

  test('escapes the code', () => {
    const { html } = renderEmail({
      ...withCode,
      paragraphs: [{ code: '<b>1</b>' }],
    })
    expect(html).toContain('&lt;b&gt;1&lt;/b&gt;')
    expect(html).not.toContain('<b>1</b>')
  })
})
