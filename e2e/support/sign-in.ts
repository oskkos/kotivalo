// Signing in from Playwright. The app runs with EMAIL_TRANSPORT "capture", so
// the code is read from the test inbox (GET /api/test/inbox). Each test uses
// its own address and client IP (x-test-client-ip), so the request limits of
// one test never affect another.
import { expect, type APIRequestContext, type Page } from '@playwright/test'

let sequence = 0

export function uniqueEmail(name: string): string {
  sequence += 1
  const id = `${String(Date.now())}-${String(process.pid)}-${String(sequence)}`
  return `${name}-${id}@example.com`
}

/** Gives the page's requests their own client IP for the request limits. */
export async function useOwnClientIp(page: Page): Promise<void> {
  const octet = () => String(Math.floor(Math.random() * 254) + 1)
  await page.setExtraHTTPHeaders({
    'x-test-client-ip': `10.${octet()}.${octet()}.${octet()}`,
  })
}

interface InboxEmail {
  subject: string
  text: string
}

export async function inbox(
  request: APIRequestContext,
  email: string,
): Promise<InboxEmail[]> {
  const response = await request.get(
    `/api/test/inbox?to=${encodeURIComponent(email)}`,
  )
  expect(response.ok()).toBe(true)
  return (await response.json()) as InboxEmail[]
}

/** Waits for the `count`th email to `email` and returns its code. */
export async function codeFor(
  request: APIRequestContext,
  email: string,
  count = 1,
): Promise<string> {
  let emails: InboxEmail[] = []
  await expect
    .poll(async () => {
      emails = await inbox(request, email)
      return emails.length
    })
    .toBeGreaterThanOrEqual(count)
  const code = /^\d{6}$/m.exec(emails[count - 1]?.text ?? '')?.[0]
  if (code === undefined) {
    throw new Error(`No code in the email to ${email}`)
  }
  return code
}

/** Fills in the email step and waits for the code step. */
export async function requestCode(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in')
  await page
    .getByRole('textbox', { name: /email|sähköposti|e-post/i })
    .fill(email)
  await page
    .getByRole('button', { name: /send code|lähetä koodi|skicka kod/i })
    .click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /enter the code|syötä koodi|ange koden/i,
  )
}

/** Signs in as `email` (a new account the first time) and waits for `/`. */
export async function signIn(page: Page, email: string): Promise<void> {
  await useOwnClientIp(page)
  const earlier = (await inbox(page.request, email)).length
  await requestCode(page, email)
  const code = await codeFor(page.request, email, earlier + 1)
  await page
    .getByLabel(/sign-in code|kirjautumiskoodi|inloggningskod/i)
    .fill(code)
  await page.waitForURL('/')
}
