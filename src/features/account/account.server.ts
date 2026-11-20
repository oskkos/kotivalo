// The account page's changes (openspec: account). The name is changed through
// authentication's setDisplayName; the language here.
import type { UserRepository } from '#/features/authentication/user.repository.server'
import type { Locale } from '#/paraglide/runtime.js'
import type { Logger } from '#/server/log/log'

export interface AccountDeps {
  /** The signed-in user. */
  userId: string
  /** Their stored language. */
  currentLocale: Locale
  users: UserRepository
  log: Logger
  now: () => Date
}

/**
 * Stores the language on the account (spec: "Choosing the language on the
 * account page"). The current language changes nothing.
 */
export async function setLanguage(
  deps: AccountDeps,
  locale: Locale,
): Promise<{ ok: true; changed: boolean }> {
  if (locale === deps.currentLocale) {
    return { ok: true, changed: false }
  }
  await deps.users.setLocale(deps.userId, locale, deps.now())
  deps.log.info('authentication.locale_changed', { locale, source: 'account' })
  return { ok: true, changed: true }
}
