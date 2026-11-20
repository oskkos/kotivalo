// Server functions for the account page (openspec: account).
import { createServerFn } from '@tanstack/react-start'
import { setLocaleCookie } from '#/features/authentication/locale-cookie.server'
import { localeInput } from '#/features/authentication/schemas'
import { userRepository } from '#/features/authentication/user.repository.server'
import { getRequestContext } from '#/server/platform/context.server'
import { setLanguage } from './account.server'

/** Stores the language on the account and in the language cookie. */
export const setAccountLanguage = createServerFn({ method: 'POST' })
  .validator(localeInput)
  .handler(async ({ data }) => {
    const context = getRequestContext()
    const session = await context.auth.getSession()
    if (!session) {
      throw new Error('Not signed in')
    }
    const result = await setLanguage(
      {
        userId: session.user.id,
        currentLocale: session.user.locale,
        users: userRepository(context.db),
        log: context.log,
        now: () => new Date(),
      },
      data.locale,
    )
    setLocaleCookie(data.locale)
    return result
  })
