// A language the user chose from the sign-in page's menu, remembered for this
// tab only (spec: "Choosing the language before sign-in"). sessionStorage is
// gone when the tab closes, so a choice made by the previous user of a shared
// device never carries over; the language cookie alone never counts as one.
import { isLocale, type Locale } from '#/paraglide/runtime.js'

const KEY = 'kotivalo_locale_chosen'

// Some private modes throw on sessionStorage: then nothing is remembered and
// the sign-in behaves as without a choice.
export function rememberChosenLocale(locale: Locale): void {
  try {
    sessionStorage.setItem(KEY, locale)
  } catch {
    // Not available.
  }
}

export function chosenLocale(): Locale | undefined {
  try {
    const value = sessionStorage.getItem(KEY)
    return value !== null && isLocale(value) ? value : undefined
  } catch {
    return undefined
  }
}

export function forgetChosenLocale(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Not available.
  }
}
