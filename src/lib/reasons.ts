// Why something failed, as a code: validation errors from Zod schemas and
// expected failures from server functions. Schemas and server functions
// return codes, never text, so the UI shows every error in the user's
// language through Paraglide (CLAUDE.md, "Forms and validation").
import { m } from '#/paraglide/messages.js'

/** Errors shown under the field they belong to. */
export type FieldReason = 'email_invalid' | 'code_invalid' | 'code_wrong'

/** Errors about the whole action, shown as an alert with a title. */
export type AlertReason =
  | 'code_expired'
  | 'code_attempts_used'
  | 'limit_reached'
  | 'email_quota'
  | 'email_busy'
  | 'email_failed'
  /** A request failed in a way the app doesn't expect (network, server error). */
  | 'unexpected'

export type Reason = FieldReason | AlertReason

export interface ReasonText {
  /** Set for alerts. */
  title?: string
  text: string
}

// Static keys: Paraglide's no-dynamic-message-access rule holds, and
// messages.test.ts checks every key exists in every language.
const texts: Record<Reason, () => ReasonText> = {
  email_invalid: () => ({ text: m.reason_email_invalid() }),
  code_invalid: () => ({ text: m.reason_code_invalid() }),
  code_wrong: () => ({ text: m.reason_code_wrong() }),
  code_expired: () => ({
    title: m.reason_code_expired_title(),
    text: m.reason_code_expired(),
  }),
  code_attempts_used: () => ({
    title: m.reason_code_attempts_used_title(),
    text: m.reason_code_attempts_used(),
  }),
  limit_reached: () => ({
    title: m.reason_limit_reached_title(),
    text: m.reason_limit_reached(),
  }),
  email_quota: () => ({
    title: m.reason_email_quota_title(),
    text: m.reason_email_quota(),
  }),
  email_busy: () => ({
    title: m.reason_email_busy_title(),
    text: m.reason_email_busy(),
  }),
  email_failed: () => ({
    title: m.reason_email_failed_title(),
    text: m.reason_email_failed(),
  }),
  unexpected: () => ({
    title: m.reason_unexpected_title(),
    text: m.reason_unexpected(),
  }),
}

export function isReason(value: unknown): value is Reason {
  return typeof value === 'string' && Object.hasOwn(texts, value)
}

/** The text for a reason, in the current language. */
export function reasonText(reason: Reason): ReasonText {
  return texts[reason]()
}
