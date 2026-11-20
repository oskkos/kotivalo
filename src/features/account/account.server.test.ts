import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { userRepository } from '#/features/authentication/user.repository.server'
import type { Locale } from '#/paraglide/runtime.js'
import { createDb } from '#/server/platform/db.server'
import { createCaptureLogger } from '#/server/platform/logger.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { setLanguage } from './account.server'

const users = userRepository(createDb(env.DB))
const now = new Date(Date.UTC(2026, 10, 20, 12, 0, 0))

function depsFor(userId: string, currentLocale: Locale) {
  const { log, lines } = createCaptureLogger()
  return {
    deps: { userId, currentLocale, users, log, now: () => now },
    lines,
  }
}

const localeOf = async (id: string) =>
  (
    await env.DB.prepare('SELECT locale FROM user WHERE id = ?')
      .bind(id)
      .first<{ locale: string }>()
  )?.locale

beforeEach(async () => {
  await emptyTables('user')
  await addTestUser('anna')
  await addTestUser('bertta')
})

describe('Choosing the language on the account page', () => {
  test('Switching from Finnish to Swedish', async () => {
    const { deps, lines } = depsFor('anna', 'fi')

    expect(await setLanguage(deps, 'sv')).toEqual({ ok: true, changed: true })

    expect(await localeOf('anna')).toBe('sv')
    expect(await localeOf('bertta')).toBe('fi')
    expect(lines).toContainEqual(
      expect.objectContaining({
        level: 'info',
        event: 'authentication.locale_changed',
        locale: 'sv',
        source: 'account',
      }),
    )
  })

  test('Switching back to Finnish', async () => {
    await users.setLocale('anna', 'en', now)

    await setLanguage(depsFor('anna', 'en').deps, 'fi')

    expect(await localeOf('anna')).toBe('fi')
  })

  test('the current language changes nothing and logs nothing', async () => {
    const { deps, lines } = depsFor('anna', 'fi')

    expect(await setLanguage(deps, 'fi')).toEqual({ ok: true, changed: false })
    expect(lines).toEqual([])
  })
})
