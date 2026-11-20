import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { createDb } from '#/server/platform/db.server'
import { createCaptureLogger } from '#/server/platform/logger.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { setDisplayName } from './display-name.server'
import { userRepository } from './user.repository.server'

const db = createDb(env.DB)
const now = new Date(Date.UTC(2026, 10, 20, 12, 0, 0))

function depsFor(userId: string) {
  const { log, lines } = createCaptureLogger()
  return {
    deps: { userId, users: userRepository(db), log, now: () => now },
    lines,
  }
}

const nameOf = async (id: string) =>
  env.DB.prepare('SELECT name, updated_at FROM user WHERE id = ?')
    .bind(id)
    .first<{ name: string; updated_at: number }>()

beforeEach(async () => {
  await emptyTables('user')
  await addTestUser('anna')
  await addTestUser('bertta')
})

describe('Display name', () => {
  test('stores the name on the signed-in user only', async () => {
    await setDisplayName(depsFor('anna').deps, 'Annika')

    expect(await nameOf('anna')).toEqual({
      name: 'Annika',
      updated_at: now.getTime(),
    })
    expect((await nameOf('bertta'))?.name).toBe('')
  })

  test('logs that the name was set, without the name', async () => {
    const { deps, lines } = depsFor('anna')
    await setDisplayName(deps, 'Annika')

    expect(lines).toEqual([
      expect.objectContaining({
        level: 'info',
        event: 'authentication.name_set',
      }),
    ])
    expect(JSON.stringify(lines)).not.toContain('Annika')
  })
})
