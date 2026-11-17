import { drizzle } from 'drizzle-orm/d1'
import type { BatchItem } from 'drizzle-orm/batch'
import * as schema from '#/server/db/schema'

/** Creates the Drizzle client for one request. Cheap: no connection pool. */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

/** The database the app receives through the per-request context. */
export type Db = ReturnType<typeof createDb>

/**
 * Runs statements atomically: all of them or none. D1 has no interactive
 * transactions (`db.transaction()` with reads between writes), only batches,
 * so build every statement first and pass them here. This is the only place
 * that calls D1's batch, so another database can swap in a transaction.
 */
export function atomically<
  T extends readonly [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]],
>(db: Db, statements: T) {
  return db.batch(statements)
}
