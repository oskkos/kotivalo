import { env } from 'cloudflare:workers'
import { getRequest } from '@tanstack/react-start/server'
import type { Auth } from '#/server/auth/auth'
import type { SendEmail } from '#/server/email/email'
import type { FileStorage } from '#/server/files/storage'
import type { Logger } from '#/server/log/log'
import { createAuth } from './auth.server'
import { createDb, type Db } from './db.server'
import { createLogger } from './logger.server'
import { createSendEmail, isCapturing } from './mailer.server'
import { createR2Storage } from './storage.server'

/** What server code receives instead of Cloudflare bindings. */
export interface RequestContext {
  db: Db
  /** Sends one email; see src/server/email/email.ts. */
  sendEmail: SendEmail
  /** Private files; see src/server/files/storage.ts. */
  storage: FileStorage
  /** Structured logs; see src/server/log/log.ts. */
  log: Logger
  /**
   * Sign-in and sessions for the current request; see
   * src/server/auth/auth.ts. Created on first use.
   */
  readonly auth: Auth
  /** The client's IP address, for abuse limits; "unknown" without one. */
  clientIp(): string
}

/**
 * Builds the context for the current request. Bindings exist only while a
 * request is handled, so call this per request, never at module scope.
 */
export function getRequestContext(): RequestContext {
  const db = createDb(env.DB)
  let auth: Auth | undefined
  return {
    db,
    sendEmail: createSendEmail(env),
    storage: createR2Storage(env.FILES),
    log: createLogger(),
    get auth() {
      auth ??= createAuth({
        db,
        secret: requireSecret(env.BETTER_AUTH_SECRET),
        baseURL: new URL(getRequest().url).origin,
        headers: () => getRequest().headers,
      })
      return auth
    },
    clientIp: () => clientIp(getRequest().headers, isCapturing(env)),
  }
}

function requireSecret(secret: string | undefined): string {
  if (!secret) {
    throw new Error(
      'BETTER_AUTH_SECRET is not set: wrangler secret put BETTER_AUTH_SECRET',
    )
  }
  return secret
}

/**
 * Cloudflare sets cf-connecting-ip and clients can't override it. Only while
 * capturing email (local runs and tests, never production) may a test choose
 * its address with x-test-client-ip, so each Playwright test gets its own
 * limits.
 */
export function clientIp(headers: Headers, capturing: boolean): string {
  const testIp = capturing ? headers.get('x-test-client-ip') : null
  return testIp ?? headers.get('cf-connecting-ip') ?? 'unknown'
}
