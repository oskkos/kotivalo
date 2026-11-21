// Rent, charges and the financing charge treatment as monthly periods
// (openspec: recurring-amounts). Pure functions: no database access. Every
// period starts on the first of a month, and a month's value is the one in
// effect on its first day, so the month is the only unit: no proration.
import type { IsoDate } from '#/lib/dates'

/** One period of a value: an amount in cents, or a treatment. */
export interface Period<T> {
  validFrom: IsoDate
  /** Null for the current, open-ended period. */
  validTo: IsoDate | null
  value: T
}

/** A calendar month as `YYYY-MM`. */
export type Month = string

export const monthOf = (date: IsoDate): Month => date.slice(0, 7)

const firstDay = (month: Month): IsoDate => `${month}-01`

/** The month after `month`: `2025-12` → `2026-01`. */
export function nextMonth(month: Month): Month {
  const [year, m] = month.split('-').map(Number) as [number, number]
  return m === 12
    ? `${String(year + 1)}-01`
    : `${String(year)}-${String(m + 1).padStart(2, '0')}`
}

export type AmountDateProblem =
  | 'amount_date_not_month_start'
  | 'amount_date_before_ownership'
  | 'amount_date_too_early'

/**
 * A new amount or treatment starts on the first of a month, not before the
 * month the flat's ownership starts in, and not before the latest period's
 * start. On that start itself it corrects the latest period.
 */
export function validateAmountDate(
  from: IsoDate,
  limits: { ownershipStart: IsoDate; latestStart: IsoDate | undefined },
): AmountDateProblem | undefined {
  if (!from.endsWith('-01')) {
    return 'amount_date_not_month_start'
  }
  if (monthOf(from) < monthOf(limits.ownershipStart)) {
    return 'amount_date_before_ownership'
  }
  if (limits.latestStart !== undefined && from < limits.latestStart) {
    return 'amount_date_too_early'
  }
  return undefined
}

/** The period containing a date, if any. */
export function periodOn<T>(
  periods: readonly Period<T>[],
  date: IsoDate,
): Period<T> | undefined {
  return periods.find(
    (p) => p.validFrom <= date && (p.validTo === null || date <= p.validTo),
  )
}

/** A month's value: the one in effect on its first day. */
export function valueInMonth<T>(
  periods: readonly Period<T>[],
  month: Month,
): T | undefined {
  return periodOn(periods, firstDay(month))?.value
}

/** Each month's amount of a year, January first; undefined when unset. */
export function monthlyAmounts(
  periods: readonly Period<number>[],
  year: number,
): (number | undefined)[] {
  return Array.from({ length: 12 }, (_, i) =>
    valueInMonth(periods, `${String(year)}-${String(i + 1).padStart(2, '0')}`),
  )
}

/** What the page shows: the period in effect today and the next one. */
export function currentAndUpcoming<T>(
  periods: readonly Period<T>[],
  today: IsoDate,
): { current: Period<T> | undefined; upcoming: Period<T> | undefined } {
  return {
    current: periodOn(periods, today),
    upcoming: periods.find((p) => p.validFrom > today),
  }
}

export interface YearEffect {
  /** Per month, in cents; negative for a decrease. */
  difference: number
  /** Of the current amount; undefined when it is zero. */
  percent: number | undefined
  year: number
  /** Months from the change to the end of its year. */
  months: number
  /** `difference` times `months`. */
  total: number
}

/** How a new amount from `from` changes the rest of that year. */
export function yearEffect(
  currentCents: number,
  newCents: number,
  from: IsoDate,
): YearEffect {
  const [year, month] = from.split('-').map(Number) as [number, number]
  const difference = newCents - currentCents
  const months = 13 - month
  return {
    difference,
    percent: currentCents === 0 ? undefined : (difference / currentCents) * 100,
    year,
    months,
    total: difference * months,
  }
}

/**
 * The financing charges added to the acquisition cost so far: the charge of
 * every month up to and including today's whose treatment on its first day
 * is capitalised.
 */
export function accumulatedCapitalised(
  financing: readonly Period<number>[],
  treatments: readonly Period<'income_recognised' | 'capitalised'>[],
  today: IsoDate,
): number {
  if (financing.length === 0) {
    return 0
  }
  const first = financing[0]
  let total = 0
  const last = monthOf(today)
  for (let month = monthOf(first.validFrom); month <= last;) {
    if (valueInMonth(treatments, month) === 'capitalised') {
      total += valueInMonth(financing, month) ?? 0
    }
    month = nextMonth(month)
  }
  return total
}
