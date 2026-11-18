import { env } from 'cloudflare:workers'
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { beforeEach, describe, expect, inject, test } from 'vitest'
import { getRequestContext } from './context.server'
import { atomically, createDb } from './db.server'

// A table that exists only in this test file, to exercise the helpers
// without depending on the app schema.
const items = sqliteTable('test_atomically_items', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
})

describe('Test database', () => {
  test('has every D1 migration applied', async () => {
    const applied = await env.DB.prepare(
      'SELECT count(*) AS count FROM d1_migrations',
    ).first<{ count: number }>()
    expect(applied?.count).toBe(inject('d1Migrations').length)
  })

  test('has the authentication tables', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('user', 'session', 'account', 'verification', 'rate_limit') ORDER BY name",
    ).all<{ name: string }>()
    expect(results.map((r) => r.name)).toEqual([
      'account',
      'rate_limit',
      'session',
      'user',
      'verification',
    ])
  })
})

describe('Request context', () => {
  test('gives a Drizzle client on the D1 binding', async () => {
    const { db } = getRequestContext()
    expect(await db.get<{ one: number }>(sql`SELECT 1 AS one`)).toEqual({
      one: 1,
    })
  })
})

describe('atomically', () => {
  const db = createDb(env.DB)

  beforeEach(async () => {
    await env.DB.exec('DROP TABLE IF EXISTS test_atomically_items')
    await env.DB.exec(
      'CREATE TABLE test_atomically_items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)',
    )
  })

  test('applies every statement when all succeed', async () => {
    await atomically(db, [
      db.insert(items).values({ id: 1, name: 'a' }),
      db.insert(items).values({ id: 2, name: 'b' }),
    ])
    expect(await db.select().from(items).orderBy(items.id)).toEqual([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ])
  })

  test('applies none of them when one fails', async () => {
    await expect(
      atomically(db, [
        db.insert(items).values({ id: 1, name: 'a' }),
        db.insert(items).values({ id: 1, name: 'duplicate key' }),
      ]),
    ).rejects.toThrow()
    expect(await db.select().from(items)).toEqual([])
  })
})
