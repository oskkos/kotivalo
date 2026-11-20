import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { userRepository } from './user.repository.server'

const users = userRepository(createDb(env.DB))
const now = new Date(Date.UTC(2026, 10, 20, 12, 0, 0))

const localeOf = async (id: string) =>
  env.DB.prepare('SELECT locale, updated_at FROM user WHERE id = ?')
    .bind(id)
    .first<{ locale: string; updated_at: number }>()

beforeEach(async () => {
  await emptyTables('user')
  await addTestUser('anna')
  await addTestUser('bertta')
})

describe('userRepository.setLocale', () => {
  test("stores the language on that user's account only", async () => {
    await users.setLocale('anna', 'sv', now)

    expect(await localeOf('anna')).toEqual({
      locale: 'sv',
      updated_at: now.getTime(),
    })
    expect((await localeOf('bertta'))?.locale).toBe('fi')
  })
})
