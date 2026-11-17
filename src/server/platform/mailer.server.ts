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
        }),
      })
    } catch (cause) {
      throw new EmailError('unavailable', 'Could not reach Resend', { cause })
    }
    if (response.ok) {
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

/** The sender for this environment. Misconfiguration fails loudly. */
export function createSendEmail(env: MailerEnv): SendEmail {
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
      })
    }
    case 'capture':
      return createCaptureSender()
    default:
      throw new Error(`Unknown EMAIL_TRANSPORT "${env.EMAIL_TRANSPORT}"`)
  }
}
