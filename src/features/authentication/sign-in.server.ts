// Signing in with an emailed code: the logic behind the server functions in
// functions.ts, with its dependencies passed in so Workers tests can drive it
// (spec: openspec/changes/add-email-sign-in/specs/authentication/spec.md).
import type { AlertReason, FieldReason } from '#/lib/reasons'
import type { Locale } from '#/paraglide/runtime.js'
import type { Auth } from '#/server/auth/auth'
import type { LimitRule } from '#/server/platform/limits.server'
import { EmailError, type SendEmail } from '#/server/email/email'
import type { Logger } from '#/server/log/log'
import { signInCodeEmail } from './sign-in-email'

export interface SignInDeps {
  auth: Auth
  sendEmail: SendEmail
  log: Logger
  /** Counts a request against a key; see platform/limits.server.ts. */
  consumeLimit: (key: string, rule: LimitRule) => Promise<{ allowed: boolean }>
  clientIp: string
  /** The language the request resolved to: for new accounts and their email. */
  requestLocale: Locale
}

/** Each code request sends an email; Resend's free plan allows 100 a day. */
export const CODE_REQUEST_LIMITS = {
  perIp: { windowSeconds: 60, max: 3 },
  perEmail: { windowSeconds: 60 * 60, max: 5 },
} as const satisfies Record<string, LimitRule>

export type RequestCodeResult =
  { ok: true } | { ok: false; reason: AlertReason }

export type VerifyCodeResult =
  | { ok: true; locale: Locale }
  | { ok: false; reason: FieldReason | AlertReason }

const EMAIL_REASONS = {
  quota: 'email_quota',
  rate_limited: 'email_busy',
  rejected: 'email_failed',
  unavailable: 'email_failed',
} as const satisfies Record<EmailError['failure'], AlertReason>

/** A key without the address in it: the table keeps no email addresses. */
async function emailKey(email: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(email),
  )
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `otp-email:${hex}`
}

/** `email` is already validated and normalised (schemas.ts). */
export async function requestCode(
  deps: SignInDeps,
  email: string,
): Promise<RequestCodeResult> {
  const { perIp, perEmail } = CODE_REQUEST_LIMITS
  if (!(await deps.consumeLimit(`otp-ip:${deps.clientIp}`, perIp)).allowed) {
    deps.log.warn('authentication.limit_reached', { limit: 'ip' })
    return { ok: false, reason: 'limit_reached' }
  }
  if (!(await deps.consumeLimit(await emailKey(email), perEmail)).allowed) {
    deps.log.warn('authentication.limit_reached', { limit: 'email' })
    return { ok: false, reason: 'limit_reached' }
  }

  const code = await deps.auth.createSignInCode(email)
  const locale = (await deps.auth.findLocale(email)) ?? deps.requestLocale
  try {
    await deps.sendEmail(signInCodeEmail({ to: email, code, locale }))
  } catch (error) {
    if (error instanceof EmailError) {
      deps.log.error(
        'authentication.code_email_failed',
        { failure: error.failure },
        error,
      )
      return { ok: false, reason: EMAIL_REASONS[error.failure] }
    }
    throw error
  }
  deps.log.info('authentication.code_requested', { locale })
  return { ok: true }
}

/**
 * Signs in, creating the account for a new address. Returns the account's
 * language, which the caller stores in the language cookie.
 */
export async function verifyCode(
  deps: SignInDeps,
  email: string,
  code: string,
): Promise<VerifyCodeResult> {
  const result = await deps.auth.signInWithCode(email, code, deps.requestLocale)
  if (!result.ok) {
    deps.log.info('authentication.sign_in_refused', { reason: result.failure })
    return { ok: false, reason: result.failure }
  }
  // The user id is on the line through the log context.
  deps.log.info('authentication.signed_in')
  return { ok: true, locale: result.user.locale }
}
