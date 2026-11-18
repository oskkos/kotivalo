// The test inbox (spec: "Test inbox for end-to-end tests"). Playwright runs
// apart from the Worker, so it reads the sign-in code from the emails the
// capture transport kept. Open only while capturing; production sends
// through Resend and gets a 404.
import { env } from 'cloudflare:workers'
import { capturedEmails, isCapturing, type MailerEnv } from './mailer.server'

/** GET /api/test/inbox?to=<address>: that address's emails, oldest first. */
export function testInboxResponse(
  request: Request,
  mailerEnv: Pick<MailerEnv, 'EMAIL_TRANSPORT'> = env,
): Response {
  if (!isCapturing(mailerEnv)) {
    return new Response('Not found', { status: 404 })
  }
  const to = new URL(request.url).searchParams.get('to')?.toLowerCase()
  const emails = capturedEmails
    .all()
    .filter((email) => email.to.toLowerCase() === to)
    .map(({ to: address, subject, text }) => ({ to: address, subject, text }))
  return Response.json(emails, { headers: { 'Cache-Control': 'no-store' } })
}
