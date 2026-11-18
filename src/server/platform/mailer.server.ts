// The email providers behind sendEmail() (src/server/email/email.ts):
// - resend: Resend's HTTPS API, for deployed environments
// - capture: keeps messages in memory and logs them, for local development
//   and tests, so they never call Resend
// EMAIL_TRANSPORT in wrangler.jsonc picks one. Switching providers means
// adding a sender here, not changing features.
import {
  assertValidMessage,
  EmailError,
  type EmailFailure,
  type EmailMessage,
  type SendEmail,
} from '#/server/email/email'
import type { Logger } from '#/server/log/log'
import { currentLogContext } from './log-context.server'

const RESEND_URL = 'https://api.resend.com/emails'

interface ResendErrorBody {
  name?: string
  message?: string
}

/** Resend's error names: https://resend.com/docs/api-reference/errors */
function resendFailure(status: number, name: string | undefined): EmailFailure {
  if (name === 'daily_quota_exceeded' || name === 'monthly_quota_exceeded') {
    return 'quota'
  }
  if (status === 429) {
    return 'rate_limited'
  }
  if (status >= 500) {
    return 'unavailable'
  }
  return 'rejected'
}

export function createResendSender(options: {
  apiKey: string
  from: string
  fetch?: typeof fetch
  log?: Logger
}): SendEmail {
  // Called through a closure: Workers throws "Illegal invocation" when the
  // global fetch is called detached from its receiver.
  const doFetch =
    options.fetch ??
    ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))
  return async (message) => {
    assertValidMessage(message)
    const headers: Record<string, string> = {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
      // Resend rejects requests without a User-Agent.
      'User-Agent': 'kotivalo',
    }
    if (message.idempotencyKey !== undefined) {
      headers['Idempotency-Key'] = message.idempotencyKey
    }

    const { traceId } = currentLogContext()
    let response: Response
    try {
      response = await doFetch(RESEND_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          from: options.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          // Resend's dashboard then shows which request sent the email.
          ...(typeof traceId === 'string'
            ? { tags: [{ name: 'trace_id', value: traceId }] }
            : {}),
        }),
      })
    } catch (cause) {
      throw new EmailError('unavailable', 'Could not reach Resend', { cause })
    }
    if (response.ok) {
      const { id } = (await response.json().catch(() => ({}))) as {
        id?: string
      }
      // Links the trace to the email in Resend; no address is logged.
      options.log?.info('email.sent', { provider: 'resend', emailId: id })
      return
    }

    const body = (await response.json().catch(() => ({}))) as ResendErrorBody
    const failure = resendFailure(response.status, body.name)
    // The recipient's address is left out of the error on purpose: errors
    // end up in logs.
    throw new EmailError(
      failure,
      `Resend responded ${String(response.status)} ${body.name ?? ''}: ${body.message ?? ''}`.trim(),
    )
  }
}

/** Messages sent through capture senders in this isolate, oldest first. */
const captured: EmailMessage[] = []

export function createCaptureSender(
  options: { log?: boolean } = {},
): SendEmail {
  // A promise like a real provider's, so an invalid message rejects.
  return (message) =>
    new Promise((resolve) => {
      assertValidMessage(message)
      captured.push(message)
      if (options.log ?? true) {
        // Local development only: shows the email, sign-in code included, in
        // the dev server's log. Never structured or shipped.
        // eslint-disable-next-line no-console
        console.info(
          `[email] To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`,
        )
      }
      resolve()
    })
}

/** For tests: the captured messages, and a way to start from none. */
export const capturedEmails = {
  all: (): readonly EmailMessage[] => [...captured],
  last: (): EmailMessage | undefined => captured.at(-1),
  clear: (): void => {
    captured.length = 0
  },
}

export interface MailerEnv {
  EMAIL_TRANSPORT: string
  EMAIL_FROM: string
  RESEND_API_KEY?: string
}

/**
 * True when emails are kept in memory instead of sent: local runs and tests.
 * Test-only helpers (the test inbox, x-test-client-ip) are open only then.
 */
export function isCapturing(env: Pick<MailerEnv, 'EMAIL_TRANSPORT'>): boolean {
  return env.EMAIL_TRANSPORT === 'capture'
}

/** The sender for this environment. Misconfiguration fails loudly. */
export function createSendEmail(env: MailerEnv, log?: Logger): SendEmail {
  switch (env.EMAIL_TRANSPORT) {
    case 'resend': {
      if (!env.RESEND_API_KEY) {
        throw new Error(
          'EMAIL_TRANSPORT is "resend" but RESEND_API_KEY is not set',
        )
      }
      return createResendSender({
        apiKey: env.RESEND_API_KEY,
        from: env.EMAIL_FROM,
        ...(log === undefined ? {} : { log }),
      })
    }
    case 'capture':
      return createCaptureSender()
    default:
      throw new Error(`Unknown EMAIL_TRANSPORT "${env.EMAIL_TRANSPORT}"`)
  }
}
