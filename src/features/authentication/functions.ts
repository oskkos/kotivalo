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
import { setDisplayName as setName } from './display-name.server'
import { displayNameInput, requestCodeInput, verifyCodeInput } from './schemas'
import { requestCode, verifyCode, type SignInDeps } from './sign-in.server'
import { userRepository } from './user.repository.server'

function signInDeps(): SignInDeps {
  const context = getRequestContext()
  return {
    auth: context.auth,
    sendEmail: context.sendEmail,
    log: context.log,
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
 * with the account's language if it was changed or removed; `localeReset`
 * then tells the layout to reload, because this request already resolved
 * its language from the old cookie.
 */
export const getSignedInUser = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await getRequestContext().auth.getSession()
    if (!session) {
      return null
    }
    const { email, name, locale } = session.user
    const localeReset = getLocale() !== locale
    if (localeReset) {
      setLocaleCookie(locale)
    }
    return { email, name, locale, localeReset }
  },
)

export const setDisplayName = createServerFn({ method: 'POST' })
  .validator(displayNameInput)
  .handler(async ({ data }) => {
    const context = getRequestContext()
    const session = await context.auth.getSession()
    if (!session) {
      throw new Error('Not signed in')
    }
    return setName(
      {
        userId: session.user.id,
        users: userRepository(context.db),
        log: context.log,
        now: () => new Date(),
      },
      data.name,
    )
  })

export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  const { auth, log } = getRequestContext()
  // Reading the session first puts the user id on the line.
  if (await auth.getSession()) {
    await auth.signOut()
    log.info('authentication.signed_out')
  }
})
