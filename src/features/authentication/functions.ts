// Server functions for signing in, called by the sign-in page and the
// signed-in layout. The logic is in sign-in.server.ts; these validate the
// input with the shared schemas and wire in the request context.
import { createServerFn } from '@tanstack/react-start'
import { setCookie } from '@tanstack/react-start/server'
import {
  cookieMaxAge,
  cookieName,
  getLocale,
  type Locale,
} from '#/paraglide/runtime.js'
import { getRequestContext } from '#/server/platform/context.server'
import { consumeLimit } from '#/server/platform/limits.server'
import { requestCodeInput, verifyCodeInput } from './schemas'
import { requestCode, verifyCode, type SignInDeps } from './sign-in.server'

function signInDeps(): SignInDeps {
  const context = getRequestContext()
  return {
    auth: context.auth,
    sendEmail: context.sendEmail,
    consumeLimit: (key, rule) => consumeLimit(context.db, key, rule),
    clientIp: context.clientIp(),
    requestLocale: getLocale(),
  }
}

/** Keeps the language cookie in step with the account's language. */
function setLocaleCookie(locale: Locale): void {
  setCookie(cookieName, locale, {
    path: '/',
    maxAge: cookieMaxAge,
    sameSite: 'lax',
  })
}

export const requestSignInCode = createServerFn({ method: 'POST' })
  .validator(requestCodeInput)
  .handler(({ data }) => requestCode(signInDeps(), data.email))

export const verifySignInCode = createServerFn({ method: 'POST' })
  .validator(verifyCodeInput)
  .handler(async ({ data }) => {
    const result = await verifyCode(signInDeps(), data.email, data.code)
    if (result.ok) {
      setLocaleCookie(result.locale)
    }
    return result
  })

/**
 * The signed-in user, or null. Also puts the language cookie back in step
 * with the account's language if it was changed or removed (design decision
 * 7); the next page load then uses it.
 */
export const getSignedInUser = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await getRequestContext().auth.getSession()
    if (!session) {
      return null
    }
    const { email, locale } = session.user
    if (getLocale() !== locale) {
      setLocaleCookie(locale)
    }
    return { email, locale }
  },
)

export const signOut = createServerFn({ method: 'POST' }).handler(() =>
  getRequestContext().auth.signOut(),
)
