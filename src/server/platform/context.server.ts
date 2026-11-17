import { env } from 'cloudflare:workers'
import type { SendEmail } from '#/server/email/email'
import type { FileStorage } from '#/server/files/storage'
import { createDb, type Db } from './db.server'
import { createSendEmail } from './mailer.server'
import { createR2Storage } from './storage.server'

/**
 * What server code receives instead of Cloudflare bindings. Auth is added
 * here when it lands (#13).
 */
export interface RequestContext {
  db: Db
  /** Sends one email; see src/server/email/email.ts. */
  sendEmail: SendEmail
  /** Private files; see src/server/files/storage.ts. */
  storage: FileStorage
}

/**
 * Builds the context for the current request. Bindings exist only while a
 * request is handled, so call this per request, never at module scope.
 */
export function getRequestContext(): RequestContext {
  return {
    db: createDb(env.DB),
    sendEmail: createSendEmail(env),
    storage: createR2Storage(env.FILES),
  }
}
