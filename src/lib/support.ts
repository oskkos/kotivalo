// The support address, one per language. Shown on the sign-in code step, the
// account page and in the footer of every email (openspec: support).
import type { Locale } from '#/paraglide/runtime.js'

const SUPPORT_ADDRESS: Record<Locale, string> = {
  fi: 'tuki@kotivalo.app',
  sv: 'support@kotivalo.app',
  en: 'support@kotivalo.app',
}

export function supportAddress(locale: Locale): string {
  return SUPPORT_ADDRESS[locale]
}
