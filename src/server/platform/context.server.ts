import { env } from 'cloudflare:workers'
import type { SendEmail } from '#/server/email/email'
import { createDb, type Db } from './db.server'
import { createSendEmail } from './mailer.server'

/**
 * What server code receives instead of Cloudflare bindings. Storage and
 * auth are added here as they land (#9, #13).
 */
export interface RequestContext {
  db: Db
  /** Sends one email; see src/server/email/email.ts. */
  sendEmail: SendEmail
}

/**
 * Builds the context for the current request. Bindings exist only while a
 * request is handled, so call this per request, never at module scope.
 */
export function getRequestContext(): RequestContext {
  return { db: createDb(env.DB), sendEmail: createSendEmail(env) }
}
