// Abuse limits: a counter per key in a fixed window, kept in D1 because
// Worker isolates share no memory. Used e.g. for sign-in code requests per IP
// address and per email address.
import { sql } from 'drizzle-orm'
import { rateLimit } from '#/server/db/schema'
import type { Db } from './db.server'

export interface LimitRule {
  /** Length of the window in seconds, counted from its first request. */
  windowSeconds: number
  /** Requests allowed in one window. */
  max: number
}

export interface LimitResult {
  allowed: boolean
  /** Requests counted in the current window, this one included. */
  count: number
  /** Seconds until the window resets; 0 when allowed. */
  retryAfterSeconds: number
}

/**
 * Counts one request against `key` and tells whether it is within the rule.
 * A refused request still counts, so hammering a key keeps it refused until
 * the window resets.
 *
 * One statement (an upsert that resets an expired window or adds one), so
 * concurrent requests can't both slip under the limit. `INSERT … ON CONFLICT
 * DO UPDATE … RETURNING` with `CASE` works in SQLite and PostgreSQL.
 */
export async function consumeLimit(
  db: Db,
  key: string,
  rule: LimitRule,
  now: Date = new Date(),
): Promise<LimitResult> {
  const windowMs = rule.windowSeconds * 1000
  const expired = sql`${rateLimit.windowStart} <= ${now.getTime() - windowMs}`
  const rows = await db
    .insert(rateLimit)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${rateLimit.count} + 1 END`,
        windowStart: sql`CASE WHEN ${expired} THEN ${now.getTime()} ELSE ${rateLimit.windowStart} END`,
      },
    })
    .returning({ count: rateLimit.count, windowStart: rateLimit.windowStart })
  const row = rows.at(0)
  if (!row) {
    throw new Error('consumeLimit: the upsert returned no row')
  }
  if (row.count <= rule.max) {
    return { allowed: true, count: row.count, retryAfterSeconds: 0 }
  }
  const resetsAt = row.windowStart.getTime() + windowMs
  return {
    allowed: false,
    count: row.count,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((resetsAt - now.getTime()) / 1000),
    ),
  }
}
