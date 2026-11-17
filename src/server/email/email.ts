// Sending email, independent of the provider (CLAUDE.md, "Cloudflare stays
// inside src/server/platform/"). Features build a message with a template
// (layout.ts and the feature's own) and send it with the request context's
// sendEmail(). The provider behind it is chosen in src/server/platform/.

export interface EmailMessage {
  /** One recipient address. */
  to: string
  subject: string
  /** Plain-text body; every email has one. */
  text: string
  html: string
  /**
   * Makes a retried send safe: the provider sends the message once per key
   * within 24 hours. Use a stable id, e.g. the invitation id.
   */
  idempotencyKey?: string
}

export type SendEmail = (message: EmailMessage) => Promise<void>

/**
 * Why a send failed:
 * - `quota`: the provider's daily or monthly limit is used up. Sending again
 *   fails until it resets (daily: midnight UTC). Not retried.
 * - `rate_limited`: too many sends per second; may succeed a moment later.
 * - `rejected`: the provider refused the message or our credentials, e.g.
 *   an invalid address or an unverified sender domain. Retrying won't help.
 * - `unavailable`: the provider failed or could not be reached.
 */
export type EmailFailure = 'quota' | 'rate_limited' | 'rejected' | 'unavailable'

export class EmailError extends Error {
  override name = 'EmailError'

  constructor(
    readonly failure: EmailFailure,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

// Deliberately loose: the provider validates addresses. This only catches
// values that are clearly not one address (empty, a list, line breaks).
const ONE_ADDRESS = /^[^\s@,;<>]+@[^\s@,;<>]+$/

/** Checks a message before it reaches a provider. */
export function assertValidMessage(message: EmailMessage): void {
  if (!ONE_ADDRESS.test(message.to)) {
    throw new EmailError('rejected', 'Recipient is not a single address')
  }
  if (message.subject.trim() === '' || /[\r\n]/.test(message.subject)) {
    throw new EmailError('rejected', 'Subject is empty or has line breaks')
  }
  if (message.text.trim() === '') {
    throw new EmailError('rejected', 'Plain-text body is empty')
  }
}
