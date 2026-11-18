// Signing in, independent of the auth library (CLAUDE.md, "Cloudflare stays
// inside src/server/platform/"). Server code gets an `Auth` from the request
// context; Better Auth behind it lives in src/server/platform/auth.server.ts.
import type { Locale } from '#/paraglide/runtime.js'

export interface AuthUser {
  id: string
  email: string
  /** The language stored on the account. */
  locale: Locale
}

export interface AuthSession {
  user: AuthUser
  expiresAt: Date
}

/**
 * Why a code did not sign the user in:
 * - `code_wrong`: not the code that was sent (or no code was sent)
 * - `code_expired`: older than its validity
 * - `code_attempts_used`: too many wrong attempts; a new code is needed
 */
export type SignInFailure = 'code_wrong' | 'code_expired' | 'code_attempts_used'

export type SignInResult =
  { ok: true; user: AuthUser } | { ok: false; failure: SignInFailure }

export interface Auth {
  /**
   * Creates a 6-digit sign-in code for the address and returns it, so the
   * caller can email it. A new code replaces any earlier one.
   */
  createSignInCode(email: string): Promise<string>
  /**
   * Signs in with a code and sets the session cookie. An address without an
   * account gets one, with `newUserLocale` as its language.
   */
  signInWithCode(
    email: string,
    code: string,
    newUserLocale: Locale,
  ): Promise<SignInResult>
  /** The current request's session, or null when not signed in. */
  getSession(): Promise<AuthSession | null>
  /** Ends the current session on the server and clears its cookie. */
  signOut(): Promise<void>
  /** The stored language of the account with this address, if any. */
  findLocale(email: string): Promise<Locale | null>
}
