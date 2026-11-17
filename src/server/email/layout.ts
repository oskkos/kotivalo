// The shared email layout: one heading, a few paragraphs and an optional
// button, as HTML and plain text, in the recipient's language. Feature
// templates (sign-in link, invitation, reminder) fill it with their own
// Paraglide messages, rendered with { locale } for the recipient.
import { m } from '#/paraglide/messages.js'
import type { Locale } from '#/paraglide/runtime.js'
import { colors, radii } from '#/theme/tokens'
import type { EmailMessage } from './email'

export interface EmailContent {
  to: string
  locale: Locale
  subject: string
  heading: string
  paragraphs: string[]
  /** A button with a link, e.g. "Sign in". The URL is also shown as text. */
  action?: { label: string; url: string }
  idempotencyKey?: string
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Escapes text for HTML content and attribute values. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char)
}

function assertHttpUrl(url: string): void {
  const { protocol } = new URL(url)
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new Error(`Email links must be http(s), got ${protocol}`)
  }
}

export function renderEmail(content: EmailContent): EmailMessage {
  const { locale, action } = content
  if (action) {
    assertHttpUrl(action.url)
  }
  const footer = `Kotivalo – ${m.app_tagline({}, { locale })}`

  const text = [
    content.heading,
    ...content.paragraphs,
    ...(action ? [`${action.label}: ${action.url}`] : []),
    '—',
    footer,
  ].join('\n\n')

  const paragraph = (value: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escapeHtml(value)}</p>`
  const button = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:14px 24px;border-radius:${String(radii.pill)}px;background:${colors.plum};color:${colors.cream};font-weight:800;text-decoration:none">${escapeHtml(action.label)}</a></p>` +
      paragraph(m.email_action_fallback({}, { locale })) +
      `<p style="margin:0 0 16px;font-size:14px;word-break:break-all"><a href="${escapeHtml(action.url)}" style="color:${colors.plum}">${escapeHtml(action.url)}</a></p>`
    : ''

  const html = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:24px 16px;background:${colors.cream};color:${colors.plum};font-family:'Segoe UI',system-ui,-apple-system,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:24px;background:${colors.white};border-radius:${String(radii.card)}px">
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">${escapeHtml(content.heading)}</h1>
${content.paragraphs.map(paragraph).join('\n')}
${button}
<p style="margin:24px 0 0;font-size:13px;color:${colors.plumMuted}">${escapeHtml(footer)}</p>
</div>
</body>
</html>`

  return {
    to: content.to,
    subject: content.subject,
    text,
    html,
    ...(content.idempotencyKey === undefined
      ? {}
      : { idempotencyKey: content.idempotencyKey }),
  }
}
