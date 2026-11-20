// Standalone values (amounts in tables and cards, dates in lists) are
// formatted here, in the language's own format (CONCEPT.md, i18n). Messages
// that contain a value get it already formatted from these helpers.
import { getLocale, type Locale } from '#/paraglide/runtime.js'

/** The Intl locale for each app language: the language as used in Finland. */
export const INTL_LOCALES = {
  fi: 'fi-FI',
  sv: 'sv-FI',
  en: 'en-FI',
} as const satisfies Record<Locale, string>

/** Euros from integer cents, e.g. 123456 → "1 234,56 €" in Finnish. */
export function formatMoney(cents: number, locale: Locale = getLocale()) {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Money must be integer cents, got ${String(cents)}`)
  }
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** A calendar date, e.g. "2026-03-05" → "5.3.2026" in Finnish. */
export function formatDate(iso: string, locale: Locale = getLocale()) {
  const [, year, month, day] = ISO_DATE.exec(iso) ?? []
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  // Rejects malformed strings (an invalid date throws in toISOString) and
  // dates that roll over, such as 2026-02-30.
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    throw new RangeError(`Not an ISO date (YYYY-MM-DD): ${iso}`)
  }
  // The date has no time of day; format it in UTC so it never shifts a day.
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    timeZone: 'UTC',
  }).format(date)
}

/**
 * The day of a point in time, as it was in Finland, e.g. when an invitation
 * was sent: "20.11.2026" in Finnish.
 */
export function formatDay(instant: Date, locale: Locale = getLocale()) {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    timeZone: 'Europe/Helsinki',
  }).format(instant)
}

// Plain numbers: ICU formats en-FI numbers the Finnish way ("48,5") but
// en-FI money the English way ("€1,234.56"), so English uses en-GB here to
// match the money format's decimal point.
const NUMBER_LOCALES = {
  ...INTL_LOCALES,
  en: 'en-GB',
} as const satisfies Record<Locale, string>

/** A one-decimal quantity from integer tenths, e.g. 485 → "48,5" in Finnish. */
export function formatTenths(tenths: number, locale: Locale = getLocale()) {
  if (!Number.isSafeInteger(tenths)) {
    throw new RangeError(`Expected integer tenths, got ${String(tenths)}`)
  }
  return new Intl.NumberFormat(NUMBER_LOCALES[locale], {
    maximumFractionDigits: 1,
    useGrouping: false,
  }).format(tenths / 10)
}

/** A floor area from tenths of m², e.g. 485 → "48,5 m²" in Finnish. */
export function formatArea(tenths: number, locale: Locale = getLocale()) {
  return `${formatTenths(tenths, locale)}\u00a0m²`
}
