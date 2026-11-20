import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { reasonText } from '#/lib/reasons'
import { EmailError, type SendEmail } from '#/server/email/email'
import { rateLimit, session, user, verification } from '#/server/db/schema'
import { createDb } from '#/server/platform/db.server'
import { consumeLimit } from '#/server/platform/limits.server'
import {
  createCaptureLogger,
  type LogLine,
} from '#/server/platform/logger.server'
import {
  capturedEmails,
  createCaptureSender,
} from '#/server/platform/mailer.server'
import { testInboxResponse } from '#/server/platform/test-inbox.server'
import { testBrowser, type TestBrowser } from '#/test/auth-browser.server'
import { emailSchema } from './schemas'
import { requestCode, verifyCode, type SignInDeps } from './sign-in.server'
import { userRepository } from './user.repository.server'

const db = createDb(env.DB)
/** Log lines of the current test. */
let logLines: LogLine[] = []
const DAY_MS = 24 * 60 * 60 * 1000

/** Time for the limits, moved by the tests. */
let now = new Date('2026-11-18T10:00:00Z')
const after = (seconds: number) => {
  now = new Date(now.getTime() + seconds * 1000)
}

function deps(
  browser: TestBrowser,
  overrides: Partial<SignInDeps> = {},
): SignInDeps {
  const capture = createCaptureLogger()
  logLines = capture.lines
  return {
    auth: browser.auth,
    sendEmail: createCaptureSender({ log: false }),
    log: capture.log,
    consumeLimit: (key, rule) => consumeLimit(db, key, rule, now),
    clientIp: '203.0.113.1',
    requestLocale: 'fi',
    appUrl: 'https://kotivalo.example',
    users: userRepository(db),
    now: () => now,
    ...overrides,
  }
}

/** The code in the last email sent to `to`. */
function lastCode(to: string): string {
  const email = capturedEmails
    .all()
    .filter((e) => e.to === to)
    .at(-1)
  const code = email?.text.match(/^\d{6}$/m)?.[0]
  if (code === undefined) {
    throw new Error(`No sign-in code was sent to ${to}`)
  }
  return code
}

/** Requests a code and signs in with it. */
async function signIn(browser: TestBrowser, email: string, locale = 'fi') {
  const d = deps(browser, {
    requestLocale: locale as SignInDeps['requestLocale'],
  })
  expect(await requestCode(d, email)).toEqual({ ok: true })
  return verifyCode(d, email, lastCode(email))
}

const wrongCode = (code: string) => (code === '000000' ? '111111' : '000000')

beforeEach(async () => {
  capturedEmails.clear()
  now = new Date('2026-11-18T10:00:00Z')
  await db.delete(rateLimit)
  await db.delete(session)
  await db.delete(verification)
  await db.delete(user)
})

describe('Sign in with an emailed code', () => {
  test('A new address creates an account and signs in', async () => {
    const browser = testBrowser(db)
    expect(await signIn(browser, 'uusi@example.com')).toEqual({
      ok: true,
      locale: 'fi',
    })
    expect((await browser.auth.getSession())?.user.email).toBe(
      'uusi@example.com',
    )
    expect(await db.select().from(user)).toHaveLength(1)
  })

  test('An existing user signs in to the same account', async () => {
    await signIn(testBrowser(db), 'omistaja@example.com')
    const first = (await db.select().from(user)).at(0)

    const again = testBrowser(db)
    await signIn(again, 'omistaja@example.com')

    expect(await db.select().from(user)).toEqual([first])
    expect((await again.auth.getSession())?.user.id).toBe(first?.id)
  })

  test('The address is matched without regard to case', async () => {
    await signIn(testBrowser(db), 'omistaja@example.com')
    const email = emailSchema.parse('Omistaja@Example.com')

    const browser = testBrowser(db)
    await signIn(browser, email)

    expect(await db.select().from(user)).toHaveLength(1)
    expect((await browser.auth.getSession())?.user.email).toBe(
      'omistaja@example.com',
    )
  })

  test("The code email is in the user's language", async () => {
    await signIn(testBrowser(db), 'omistaja@example.com', 'sv')
    capturedEmails.clear()

    await requestCode(
      deps(testBrowser(db), { requestLocale: 'fi' }),
      'omistaja@example.com',
    )

    const email = capturedEmails.last()
    expect(email?.subject).toMatch(/är din inloggningskod för Kotivalo$/)
    expect(email?.text).toContain('Koden gäller i 10 minuter.')
  })
})

describe('Rejecting wrong and expired codes', () => {
  test('A wrong code shows an error', async () => {
    const browser = testBrowser(db)
    const d = deps(browser)
    await requestCode(d, 'uusi@example.com')

    expect(
      await verifyCode(
        d,
        'uusi@example.com',
        wrongCode(lastCode('uusi@example.com')),
      ),
    ).toEqual({ ok: false, reason: 'code_wrong' })
    expect(await browser.auth.getSession()).toBeNull()
    expect(reasonText('code_wrong').text).toBe(
      'Koodi ei ole oikein. Tarkista koodi ja yritä uudelleen.',
    )
  })

  test('An expired code is rejected', async () => {
    const d = deps(testBrowser(db))
    await requestCode(d, 'uusi@example.com')
    // 10 minutes and 1 second after sending.
    await db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 1000) })

    expect(
      await verifyCode(d, 'uusi@example.com', lastCode('uusi@example.com')),
    ).toEqual({ ok: false, reason: 'code_expired' })
    expect(reasonText('code_expired').text).toBe('Pyydä uusi koodi alta.')
  })

  test('Five wrong attempts use up the code', async () => {
    const d = deps(testBrowser(db))
    await requestCode(d, 'uusi@example.com')
    const code = lastCode('uusi@example.com')
    for (let i = 0; i < 5; i++) {
      expect(await verifyCode(d, 'uusi@example.com', wrongCode(code))).toEqual({
        ok: false,
        reason: 'code_wrong',
      })
    }

    expect(await verifyCode(d, 'uusi@example.com', code)).toEqual({
      ok: false,
      reason: 'code_attempts_used',
    })
  })

  test('A used code does not work twice', async () => {
    const browser = testBrowser(db)
    await signIn(browser, 'uusi@example.com')
    await browser.auth.signOut()

    expect(
      await verifyCode(
        deps(browser),
        'uusi@example.com',
        lastCode('uusi@example.com'),
      ),
    ).toMatchObject({ ok: false })
    expect(await browser.auth.getSession()).toBeNull()
  })

  test('A new code replaces the previous one', async () => {
    const browser = testBrowser(db)
    const d = deps(browser)
    await requestCode(d, 'uusi@example.com')
    const first = lastCode('uusi@example.com')
    after(1)
    await requestCode(d, 'uusi@example.com')
    const second = lastCode('uusi@example.com')

    // Two random 6-digit codes match once in a million runs.
    expect(second).not.toBe(first)
    expect(await verifyCode(d, 'uusi@example.com', first)).toMatchObject({
      ok: false,
    })
    expect(await verifyCode(d, 'uusi@example.com', second)).toEqual({
      ok: true,
      locale: 'fi',
    })
  })
})

describe('Limiting code requests', () => {
  test('A fourth request from one IP address within a minute is refused', async () => {
    const d = deps(testBrowser(db))
    const results = []
    for (const email of ['a', 'b', 'c', 'd']) {
      results.push(await requestCode(d, `${email}@example.com`))
      after(10)
    }

    expect(results).toEqual([
      { ok: true },
      { ok: true },
      { ok: true },
      { ok: false, reason: 'limit_reached' },
    ])
    expect(capturedEmails.all()).toHaveLength(3)
    expect(logLines.at(-1)).toMatchObject({
      level: 'warn',
      event: 'authentication.limit_reached',
      limit: 'ip',
    })
  })

  test('A sixth code for one address within an hour is refused', async () => {
    const results = []
    for (let i = 1; i <= 6; i++) {
      const d = deps(testBrowser(db), { clientIp: `198.51.100.${String(i)}` })
      results.push(await requestCode(d, 'omistaja@example.com'))
      after(10 * 60)
    }

    expect(results.slice(0, 5)).toEqual(Array(5).fill({ ok: true }))
    expect(results[5]).toEqual({ ok: false, reason: 'limit_reached' })
    expect(capturedEmails.all()).toHaveLength(5)
  })

  test('The address limit frees up after an hour', async () => {
    for (let i = 1; i <= 5; i++) {
      const d = deps(testBrowser(db), { clientIp: `198.51.100.${String(i)}` })
      await requestCode(d, 'omistaja@example.com')
    }
    after(60 * 60)

    expect(
      await requestCode(deps(testBrowser(db)), 'omistaja@example.com'),
    ).toEqual({ ok: true })
    expect(capturedEmails.all()).toHaveLength(6)
  })
})

describe('Telling the user when the code email cannot be sent', () => {
  const failingSender =
    (failure: EmailError['failure']): SendEmail =>
    () =>
      Promise.reject(new EmailError(failure, 'test'))

  test('The email quota is used up', async () => {
    const result = await requestCode(
      deps(testBrowser(db), { sendEmail: failingSender('quota') }),
      'uusi@example.com',
    )
    expect(result).toEqual({ ok: false, reason: 'email_quota' })
    expect(reasonText('email_quota').text).toContain('huomenna')
    // Logged for alerting, without the address.
    expect(logLines).toContainEqual(
      expect.objectContaining({
        level: 'error',
        event: 'authentication.code_email_failed',
        failure: 'quota',
      }),
    )
    expect(JSON.stringify(logLines)).not.toContain('uusi@example.com')
  })

  test('Sending is briefly limited', async () => {
    const result = await requestCode(
      deps(testBrowser(db), { sendEmail: failingSender('rate_limited') }),
      'uusi@example.com',
    )
    expect(result).toEqual({ ok: false, reason: 'email_busy' })
    expect(reasonText('email_busy').text).toBe(
      'Yritä uudelleen hetken kuluttua.',
    )
  })

  test('Sending fails for another reason', async () => {
    for (const failure of ['unavailable', 'rejected'] as const) {
      const result = await requestCode(
        deps(testBrowser(db), {
          sendEmail: failingSender(failure),
          clientIp: failure,
        }),
        'uusi@example.com',
      )
      expect(result).toEqual({ ok: false, reason: 'email_failed' })
    }
    expect(reasonText('email_failed').text).toContain('Yritä uudelleen')
  })
})

describe('Signing out', () => {
  test('A signed-out session cookie no longer works', async () => {
    const browser = testBrowser(db)
    await signIn(browser, 'uusi@example.com')
    const earlier = new Map(browser.jar)

    await browser.auth.signOut()
    for (const [name, value] of earlier) {
      browser.jar.set(name, value)
    }

    expect(await browser.auth.getSession()).toBeNull()
  })
})

describe('Staying signed in', () => {
  test('A session expires after 30 days without use', async () => {
    const browser = testBrowser(db)
    await signIn(browser, 'uusi@example.com')
    // Last refreshed 30 days and 1 second ago.
    await db.update(session).set({
      updatedAt: new Date(Date.now() - 30 * DAY_MS - 1000),
      expiresAt: new Date(Date.now() - 1000),
    })

    expect(await browser.auth.getSession()).toBeNull()
  })

  test('Using the app extends the session', async () => {
    const browser = testBrowser(db)
    await signIn(browser, 'uusi@example.com')
    // Last refreshed 2 days ago.
    await db.update(session).set({
      updatedAt: new Date(Date.now() - 2 * DAY_MS),
      expiresAt: new Date(Date.now() + 28 * DAY_MS),
    })

    const current = await browser.auth.getSession()

    const days = ((current?.expiresAt.getTime() ?? 0) - Date.now()) / DAY_MS
    expect(days).toBeCloseTo(30, 1)
    const row = (await db.select().from(session)).at(0)
    expect(row?.expiresAt.getTime()).toBe(current?.expiresAt.getTime())
  })
})

describe("The user's language is stored on the account", () => {
  test('A new account keeps the sign-in language', async () => {
    await signIn(testBrowser(db), 'uusi@example.com', 'sv')
    const rows = await db.select().from(user)
    expect(rows.map((r) => [r.email, r.locale])).toEqual([
      ['uusi@example.com', 'sv'],
    ])
  })

  test('Signing in on another device uses the stored language', async () => {
    await signIn(testBrowser(db), 'omistaja@example.com', 'sv')

    // Another browser, in Finnish: sign-in returns the stored language for
    // the language cookie.
    expect(await signIn(testBrowser(db), 'omistaja@example.com', 'fi')).toEqual(
      { ok: true, locale: 'sv' },
    )
  })
})

describe('Choosing the language before sign-in', () => {
  /** Requests a code and signs in with a language chosen on the page. */
  async function signInChoosing(
    email: string,
    chosen: 'fi' | 'sv' | 'en' | undefined,
    requestLocale: 'fi' | 'sv' | 'en',
  ) {
    const d = deps(testBrowser(db), { requestLocale })
    expect(await requestCode(d, email, chosen)).toEqual({ ok: true })
    return verifyCode(d, email, lastCode(email), chosen)
  }

  const storedLocale = async (email: string) =>
    (await db.select().from(user)).find((u) => u.email === email)?.locale

  test("Choosing a language changes an existing account's language", async () => {
    await signIn(testBrowser(db), 'omistaja@example.com', 'en')
    capturedEmails.clear()

    expect(await signInChoosing('omistaja@example.com', 'fi', 'fi')).toEqual({
      ok: true,
      locale: 'fi',
    })

    expect(capturedEmails.last()?.subject).toMatch(
      /on Kotivalo-kirjautumiskoodisi$/,
    )
    expect(await storedLocale('omistaja@example.com')).toBe('fi')
    expect(logLines).toContainEqual(
      expect.objectContaining({
        event: 'authentication.locale_changed',
        locale: 'fi',
        source: 'sign_in',
      }),
    )
  })

  test("A cookie left on the device does not change the account's language", async () => {
    await signIn(testBrowser(db), 'omistaja@example.com', 'en')
    capturedEmails.clear()

    // The request resolves to Finnish from the cookie, but nothing was chosen.
    expect(
      await signInChoosing('omistaja@example.com', undefined, 'fi'),
    ).toEqual({ ok: true, locale: 'en' })

    expect(capturedEmails.last()?.subject).toMatch(/is your Kotivalo/)
    expect(await storedLocale('omistaja@example.com')).toBe('en')
    expect(logLines.map((l) => l.event)).not.toContain(
      'authentication.locale_changed',
    )
  })

  test('choosing the stored language changes nothing', async () => {
    await signIn(testBrowser(db), 'omistaja@example.com', 'sv')

    expect(await signInChoosing('omistaja@example.com', 'sv', 'fi')).toEqual({
      ok: true,
      locale: 'sv',
    })
    expect(logLines.map((l) => l.event)).not.toContain(
      'authentication.locale_changed',
    )
  })

  test('a new account gets the chosen language', async () => {
    await signInChoosing('uusi@example.com', 'en', 'fi')
    expect(await storedLocale('uusi@example.com')).toBe('en')
  })
})

describe('Test inbox for end-to-end tests', () => {
  const inbox = (to: string) =>
    new Request(`http://localhost/api/test/inbox?to=${encodeURIComponent(to)}`)

  test('The test inbox returns captured emails', async () => {
    await requestCode(deps(testBrowser(db)), 'uusi@example.com')
    await requestCode(
      deps(testBrowser(db), { clientIp: '198.51.100.9' }),
      'muu@example.com',
    )

    const response = testInboxResponse(inbox('Uusi@example.com'))

    expect(response.status).toBe(200)
    const emails = await response.json<{ subject: string; text: string }[]>()
    expect(emails).toHaveLength(1)
    expect(emails[0]?.subject).toBe(
      `${lastCode('uusi@example.com')} on Kotivalo-kirjautumiskoodisi`,
    )
  })

  test('The test inbox is closed with a real transport', () => {
    const response = testInboxResponse(inbox('uusi@example.com'), {
      EMAIL_TRANSPORT: 'resend',
    })
    expect(response.status).toBe(404)
  })
})
