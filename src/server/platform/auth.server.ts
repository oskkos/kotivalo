// The `Auth` behind the request context (src/server/auth/auth.ts), built on
// Better Auth. Created per request: the D1 binding exists only while a request
// is handled. Better Auth's HTTP handler (/api/auth/*) is not mounted; the
// app calls these methods from server functions, which apply our own limits
// (openspec/changes/add-email-sign-in/design.md, decision 1).
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { isAPIError } from 'better-auth/api'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { eq } from 'drizzle-orm'
import { baseLocale, isLocale, type Locale } from '#/paraglide/runtime.js'
import {
  SIGN_IN_CODE,
  type Auth,
  type AuthUser,
  type SignInFailure,
  type SignInResult,
} from '#/server/auth/auth'
import { account, session, user, verification } from '#/server/db/schema'
import type { Logger } from '#/server/log/log'
import type { Db } from './db.server'
import { addLogContext } from './log-context.server'

const DAY = 24 * 60 * 60

export interface AuthOptions {
  db: Db
  /** Signs session cookies; BETTER_AUTH_SECRET. */
  secret: string
  /** The app's origin, e.g. https://kotivalo.example. */
  baseURL: string
  /** The current request's headers (cookies, client IP). */
  headers: () => Headers
  /** Logs account creation; see src/server/log/log.ts. */
  log?: Logger
  /**
   * Receives Better Auth's response headers (Set-Cookie). In the app the
   * TanStack Start cookie plugin already forwards them; tests use this to
   * carry the session cookie to the next call.
   */
  onResponseHeaders?: (headers: Headers) => void
}

const FAILURES: Record<string, SignInFailure> = {
  INVALID_OTP: 'code_wrong',
  OTP_EXPIRED: 'code_expired',
  TOO_MANY_ATTEMPTS: 'code_attempts_used',
}

function toLocale(value: unknown): Locale {
  return typeof value === 'string' && isLocale(value) ? value : baseLocale
}

export function createAuth(options: AuthOptions): Auth {
  // The language for an account created during this request; set by
  // signInWithCode before Better Auth creates the user.
  let newUserLocale: Locale = baseLocale

  const auth = betterAuth({
    baseURL: options.baseURL,
    secret: options.secret,
    database: drizzleAdapter(options.db, {
      provider: 'sqlite',
      schema: { user, session, account, verification },
    }),
    advanced: {
      database: { generateId: 'uuid' },
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    // Our own limits in D1 (platform/limits.server.ts) apply in the server
    // functions; Better Auth's limiter covers only its HTTP handler.
    rateLimit: { enabled: false },
    // No cookie cache: a cached session would keep working for its lifetime
    // after signing out (spec: "A signed-out session cookie no longer
    // works"). Each check is one D1 read.
    session: {
      expiresIn: 30 * DAY,
      updateAge: DAY,
    },
    user: {
      additionalFields: {
        locale: {
          type: 'string',
          required: true,
          input: false,
          defaultValue: baseLocale,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: (newUser) =>
            Promise.resolve({ data: { ...newUser, locale: newUserLocale } }),
          after: (created) => {
            options.log?.info('authentication.account_created', {
              userId: created.id,
              locale: newUserLocale,
            })
            return Promise.resolve()
          },
        },
      },
    },
    plugins: [
      emailOTP({
        otpLength: SIGN_IN_CODE.length,
        expiresIn: SIGN_IN_CODE.validSeconds,
        allowedAttempts: SIGN_IN_CODE.attempts,
        storeOTP: 'hashed',
        // Codes are created with createVerificationOTP and emailed by the
        // caller: Better Auth's own sending swallows errors, and we need
        // EmailError to tell the user what went wrong.
        sendVerificationOTP: () =>
          Promise.reject(
            new Error(
              'Sign-in codes are sent by the caller of createSignInCode',
            ),
          ),
      }),
      // Must stay last: it forwards Set-Cookie to TanStack Start.
      tanstackStartCookies(),
    ],
  })

  const toUser = (u: {
    id: string
    email: string
    locale?: unknown
  }): AuthUser => ({
    id: u.id,
    email: u.email,
    locale: toLocale(u.locale),
  })

  return {
    createSignInCode: (email) =>
      auth.api.createVerificationOTP({
        body: { email: email.toLowerCase(), type: 'sign-in' },
      }),

    async signInWithCode(email, code, locale): Promise<SignInResult> {
      newUserLocale = locale
      try {
        const { headers, response } = await auth.api.signInEmailOTP({
          body: { email: email.toLowerCase(), otp: code },
          headers: options.headers(),
          returnHeaders: true,
        })
        options.onResponseHeaders?.(headers)
        addLogContext({ userId: response.user.id })
        return { ok: true, user: toUser(response.user) }
      } catch (error) {
        const failure = isAPIError(error)
          ? FAILURES[String(error.body?.code)]
          : undefined
        if (failure === undefined) {
          throw error
        }
        return { ok: false, failure }
      }
    },

    async getSession() {
      const { headers, response } = await auth.api.getSession({
        headers: options.headers(),
        returnHeaders: true,
      })
      options.onResponseHeaders?.(headers)
      if (!response) {
        return null
      }
      // Every later line of this request names the user.
      addLogContext({ userId: response.user.id })
      return {
        user: toUser(response.user),
        expiresAt: response.session.expiresAt,
      }
    },

    async signOut() {
      const { headers } = await auth.api.signOut({
        headers: options.headers(),
        returnHeaders: true,
      })
      options.onResponseHeaders?.(headers)
    },

    async findLocale(email) {
      const rows = await options.db
        .select({ locale: user.locale })
        .from(user)
        .where(eq(user.email, email.toLowerCase()))
        .limit(1)
      const row = rows.at(0)
      return row ? toLocale(row.locale) : null
    },
  }
}
