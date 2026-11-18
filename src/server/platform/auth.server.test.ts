import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, test } from 'vitest'
import { session, user, verification } from '#/server/db/schema'
import { testBrowser } from '#/test/auth-browser.server'
import { createCaptureLogger } from './logger.server'
import { createDb } from './db.server'

const db = createDb(env.DB)

const browser = () => testBrowser(db)

beforeEach(async () => {
  await db.delete(session)
  await db.delete(verification)
  await db.delete(user)
})

describe('Better Auth on D1', () => {
  test('a code signs in a new address and creates the account in its language', async () => {
    const { auth } = browser()
    const code = await auth.createSignInCode('Uusi@Example.com')
    expect(code).toMatch(/^\d{6}$/)

    const result = await auth.signInWithCode('uusi@example.com', code, 'sv')

    const rows = await db.select().from(user)
    expect(rows).toHaveLength(1)
    const row = rows.at(0)
    expect(row).toMatchObject({ email: 'uusi@example.com', locale: 'sv' })
    expect(row?.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(result).toEqual({
      ok: true,
      user: { id: row?.id, email: 'uusi@example.com', locale: 'sv' },
    })
  })

  test('an existing account keeps its language', async () => {
    const first = browser().auth
    await first.signInWithCode(
      'omistaja@example.com',
      await first.createSignInCode('omistaja@example.com'),
      'en',
    )
    const second = browser().auth
    const result = await second.signInWithCode(
      'omistaja@example.com',
      await second.createSignInCode('omistaja@example.com'),
      'fi',
    )
    expect(result.ok && result.user.locale).toBe('en')
    expect(await db.select().from(user)).toHaveLength(1)
    expect(await second.findLocale('Omistaja@example.com')).toBe('en')
  })

  test('logs a new account once, not later sign-ins', async () => {
    const { log, lines } = createCaptureLogger()
    for (let i = 0; i < 2; i++) {
      const { auth } = testBrowser(db, log)
      await auth.signInWithCode(
        'uusi@example.com',
        await auth.createSignInCode('uusi@example.com'),
        'sv',
      )
    }
    const created = lines.filter(
      (l) => l.event === 'authentication.account_created',
    )
    expect(created).toEqual([
      expect.objectContaining({ level: 'info', locale: 'sv' }),
    ])
    expect(created[0]?.userId).toMatch(/^[0-9a-f-]{36}$/)
    expect(JSON.stringify(lines)).not.toContain('uusi@example.com')
  })

  test('a wrong code does not sign in', async () => {
    const { auth } = browser()
    const code = await auth.createSignInCode('uusi@example.com')
    const wrong = code === '000000' ? '111111' : '000000'
    expect(await auth.signInWithCode('uusi@example.com', wrong, 'fi')).toEqual({
      ok: false,
      failure: 'code_wrong',
    })
    expect(await db.select().from(user)).toHaveLength(0)
  })

  test('the session lasts until signing out', async () => {
    const { auth, jar } = browser()
    await auth.signInWithCode(
      'uusi@example.com',
      await auth.createSignInCode('uusi@example.com'),
      'fi',
    )
    expect(jar.size).toBeGreaterThan(0)

    const current = await auth.getSession()
    if (!current) {
      throw new Error('expected a session')
    }
    expect(current.user.email).toBe('uusi@example.com')
    const days = (current.expiresAt.getTime() - Date.now()) / 86_400_000
    expect(days).toBeCloseTo(30, 0)

    await auth.signOut()
    expect(await auth.getSession()).toBeNull()
    const rows = await db
      .select()
      .from(session)
      .where(eq(session.userId, current.user.id))
    expect(rows).toHaveLength(0)
  })

  test('without a session cookie there is no session', async () => {
    expect(await browser().auth.getSession()).toBeNull()
  })

  test('findLocale is null for an address without an account', async () => {
    expect(await browser().auth.findLocale('ei@example.com')).toBeNull()
  })
})
