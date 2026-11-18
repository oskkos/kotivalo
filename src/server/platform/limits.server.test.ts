import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { rateLimit } from '#/server/db/schema'
import { createDb } from './db.server'
import { consumeLimit } from './limits.server'

const db = createDb(env.DB)
const rule = { windowSeconds: 60, max: 3 }
const at = (seconds: number) =>
  new Date(Date.UTC(2026, 10, 18, 10, 0, 0) + seconds * 1000)

beforeEach(async () => {
  await db.delete(rateLimit)
})

describe('consumeLimit', () => {
  test('allows requests up to the limit within the window', async () => {
    const results = []
    for (const second of [0, 10, 20]) {
      results.push(await consumeLimit(db, 'ip:1', rule, at(second)))
    }
    expect(results.map((r) => r.allowed)).toEqual([true, true, true])
  })

  test('refuses the request over the limit and says when to retry', async () => {
    for (const second of [0, 10, 20]) {
      await consumeLimit(db, 'ip:1', rule, at(second))
    }
    expect(await consumeLimit(db, 'ip:1', rule, at(45))).toEqual({
      allowed: false,
      count: 4,
      retryAfterSeconds: 15,
    })
  })

  test('starts a new window once the previous one has passed', async () => {
    for (const second of [0, 10, 20, 30]) {
      await consumeLimit(db, 'ip:1', rule, at(second))
    }
    expect((await consumeLimit(db, 'ip:1', rule, at(60))).allowed).toBe(true)
    const [row] = await db.select().from(rateLimit)
    expect(row).toEqual({ key: 'ip:1', count: 1, windowStart: at(60) })
  })

  test('counts each key separately', async () => {
    for (const second of [0, 1, 2, 3]) {
      await consumeLimit(db, 'ip:1', rule, at(second))
    }
    expect((await consumeLimit(db, 'ip:2', rule, at(4))).allowed).toBe(true)
  })

  test('lets only the allowed number through concurrent requests', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => consumeLimit(db, 'ip:1', rule, at(0))),
    )
    expect(results.filter((r) => r.allowed)).toHaveLength(3)
  })
})
