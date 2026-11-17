import { env } from 'cloudflare:workers'
import { createDb, type Db } from './db.server'

/**
 * What server code receives instead of Cloudflare bindings. Storage, the
 * mailer and auth are added here as they land (#9, #12, #13).
 */
export interface RequestContext {
  db: Db
}

/**
 * Builds the context for the current request. Bindings exist only while a
 * request is handled, so call this per request, never at module scope.
 */
export function getRequestContext(): RequestContext {
  return { db: createDb(env.DB) }
}
