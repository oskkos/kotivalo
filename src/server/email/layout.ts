// The shared email layout: one heading, paragraphs and codes, and an optional
// button, as HTML and plain text, in the recipient's language. Feature
// templates (sign-in link, invitation, reminder) fill it with their own
// Paraglide messages, rendered with { locale } for the recipient.
import { m } from '#/paraglide/messages.js'
import type { Locale } from '#/paraglide/runtime.js'
import { colors, radii } from '#/theme/tokens'
import type { EmailMessage } from './email'

/**
 * One block of the body: a paragraph, or a code the reader types or copies
 * (e.g. a sign-in code), shown large and on its own line.
 */
export type EmailBlock = string | { code: string }

export interface EmailContent {
  to: string
  locale: Locale
  /** The app's origin; the logo at the top is loaded from it. */
  appUrl: string
  subject: string
  heading: string
  paragraphs: EmailBlock[]
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

/**
 * The logo at the top (public/email/logo.png, drawn by `pnpm icons:generate`
 * at twice this size). Update the size if the image is redrawn.
 */
export const EMAIL_LOGO = { path: '/email/logo.png', width: 123, height: 32 }

function assertHttpUrl(url: string): void {
  const { protocol } = new URL(url)
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new Error(`Email links must be http(s), got ${protocol}`)
  }
}

export function renderEmail(content: EmailContent): EmailMessage {
  const { locale, action } = content
  assertHttpUrl(content.appUrl)
  if (action) {
    assertHttpUrl(action.url)
  }
  const tagline = m.app_tagline({}, { locale })
  const logoUrl = new URL(EMAIL_LOGO.path, content.appUrl).href

  const text = [
    `Kotivalo – ${tagline}`,
    content.heading,
    ...content.paragraphs.map((block) =>
      typeof block === 'string' ? block : block.code,
    ),
    ...(action ? [`${action.label}: ${action.url}`] : []),
  ].join('\n\n')

  const paragraph = (value: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escapeHtml(value)}</p>`
  const block = (value: EmailBlock) =>
    typeof value === 'string'
      ? paragraph(value)
      : `<p style="margin:0 0 16px;padding:16px 0;background:${colors.cream};border:2px solid ${colors.inputBorder};border-radius:${String(radii.tile)}px;text-align:center;font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:40px;font-weight:700;letter-spacing:8px">${escapeHtml(value.code)}</p>`
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
<img src="${escapeHtml(logoUrl)}" alt="Kotivalo" width="${String(EMAIL_LOGO.width)}" height="${String(EMAIL_LOGO.height)}" style="display:block;border:0">
<p style="margin:4px 0 24px;font-size:14px;font-weight:700;color:${colors.plumMuted}">${escapeHtml(tagline)}</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">${escapeHtml(content.heading)}</h1>
${content.paragraphs.map(block).join('\n')}
${button}
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
