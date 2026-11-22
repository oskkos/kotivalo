// Calendar dates (ISO `YYYY-MM-DD`) typed by people and today's date as it
// is in Finland. Pure: no database, no request.

/** A calendar date as `YYYY-MM-DD`, as stored (`isoDate()` columns). */
export type IsoDate = string

/** Day first, with dots (Finnish, Swedish) or slashes (English in Finland). */
const FI_DATE = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * A date typed as `12.6.2022`, `12/06/2022` (as formatDate() writes it in
 * English) or `2022-06-12`, as ISO,
 * or undefined when it isn't a real date (`31.2.2026`).
 */
export function parseFiDate(text: string): IsoDate | undefined {
  const value = text.trim()
  const fi = FI_DATE.exec(value)
  const iso = ISO_DATE.exec(value)
  const parts = fi
    ? [fi[3], fi[2], fi[1]]
    : iso
      ? [iso[1], iso[2], iso[3]]
      : undefined
  if (!parts) {
    return undefined
  }
  const [year, month, day] = parts.map(Number) as [number, number, number]
  const date = new Date(Date.UTC(year, month - 1, day))
  const result = date.toISOString().slice(0, 10)
  // Rejects dates that roll over, such as 31.2.2026.
  return date.getUTCDate() === day && date.getUTCMonth() === month - 1
    ? result
    : undefined
}

/** The calendar date of a point in time in Finland, e.g. for "today". */
export function isoDateInFinland(instant: Date): IsoDate {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Helsinki',
  }).format(instant)
}

/** The day before an ISO date: `2025-03-01` → `2025-02-28`. */
export function dayBefore(date: IsoDate): IsoDate {
  const [year, month, day] = date.split('-').map(Number) as [
    number,
    number,
    number,
  ]
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10)
}

/** The last day of a month given as `YYYY-MM`: `2027-02` → `2027-02-28`. */
export function lastDayOfMonth(month: string): IsoDate {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10)
}

/** A month `YYYY-MM` moved by whole months: `2026-11` + 6 → `2027-05`. */
export function addMonths(month: string, months: number): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year, monthNumber - 1 + months, 1))
    .toISOString()
    .slice(0, 7)
}

/**
 * A date moved by whole years; 29 February becomes 28 February in a common
 * year: `2024-02-29` + 1 → `2025-02-28`.
 */
export function addYears(date: IsoDate, years: number): IsoDate {
  const [year, month, day] = date.split('-').map(Number) as [
    number,
    number,
    number,
  ]
  const target = `${String(year + years).padStart(4, '0')}-${String(month).padStart(2, '0')}`
  const last = Number(lastDayOfMonth(target).slice(8))
  return `${target}-${String(Math.min(day, last)).padStart(2, '0')}`
}
