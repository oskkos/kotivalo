// The language cookie, kept in step with the account's language after sign-in,
// on every signed-in page and when the user changes the language.
import { setCookie } from '@tanstack/react-start/server'
import { cookieMaxAge, cookieName, type Locale } from '#/paraglide/runtime.js'

export function setLocaleCookie(locale: Locale): void {
  setCookie(cookieName, locale, {
    path: '/',
    maxAge: cookieMaxAge,
    sameSite: 'lax',
  })
}
