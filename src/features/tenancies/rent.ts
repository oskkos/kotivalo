// A tenancy's rent as periods (openspec: tenancies, "The rent of a tenancy",
// "Changing a tenancy's rent", "Rent changes stay inside their tenancy").
// The first period starts on the tenancy's start day, later ones on the
// first of a month; the latest has no end, bounded by the tenancy's dates.
// Pure: no database access.
import {
  monthOf,
  periodOn,
  type Month,
  type Period,
} from '#/features/recurring-amounts/periods'
import type { IsoDate } from '#/lib/dates'

/** The dates of a tenancy that its rent depends on. */
export interface RentDates {
  validFrom: IsoDate
  /** The last day; null while an open-ended tenancy runs. */
  validTo: IsoDate | null
}

/**
 * A month's value of a tenancy's periods (rent, occupants, a fee's amount):
 * the period on the month's first day, or on the tenancy's start day in the
 * month it starts. Undefined when none is in effect.
 */
export function valueInTenancyMonth<T>(
  periods: readonly Period<T>[],
  tenancy: Pick<RentDates, 'validFrom'>,
  month: Month,
): T | undefined {
  const day =
    monthOf(tenancy.validFrom) === month ? tenancy.validFrom : `${month}-01`
  return periodOn(periods, day)?.value
}

/** A month's rent; undefined when no rent is in effect. */
export function rentInMonth(
  rents: readonly Period<number>[],
  tenancy: Pick<RentDates, 'validFrom'>,
  month: Month,
): number | undefined {
  return valueInTenancyMonth(rents, tenancy, month)
}

/**
 * The tenancy's rent in effect `today`, or its first rent when it starts
 * later; undefined without one.
 */
export function rentToday(
  rents: readonly Period<number>[],
  tenancy: Pick<RentDates, 'validFrom'>,
  today: IsoDate,
): number | undefined {
  return periodOn(rents, today < tenancy.validFrom ? tenancy.validFrom : today)
    ?.value
}

export type RentDateProblem =
  | 'amount_date_not_month_start'
  | 'rent_date_before_tenancy'
  | 'rent_date_after_tenancy'
  | 'amount_date_too_early'

/**
 * A new rent starts on the first of a month or the tenancy's start day,
 * inside the tenancy, and not before the latest period's start. On the
 * start of any of its periods (`starts`, in order) it corrects that
 * period. Before the first period's start no rent is in effect (a migrated
 * tenancy), so a date there fills the months up to the first period
 * (`fillsBeforeFirst`).
 */
export function validateRentDate(
  from: IsoDate,
  limits: { tenancy: RentDates; starts: readonly IsoDate[] },
): RentDateProblem | undefined {
  const { tenancy, starts } = limits
  if (!from.endsWith('-01') && from !== tenancy.validFrom) {
    return 'amount_date_not_month_start'
  }
  if (from < tenancy.validFrom) {
    return 'rent_date_before_tenancy'
  }
  if (tenancy.validTo !== null && from > tenancy.validTo) {
    return 'rent_date_after_tenancy'
  }
  if (fillsBeforeFirst(from, starts.at(0)) || starts.includes(from)) {
    return undefined
  }
  const latestStart = starts.at(-1)
  if (latestStart !== undefined && from < latestStart) {
    return 'amount_date_too_early'
  }
  return undefined
}

/**
 * The date of a new occupants or fee amount period: the first of a month or
 * the tenancy's start day, inside the tenancy, and not before the latest
 * period's start (`latestStart`, none for a fee's first amount). On that
 * start itself it corrects the latest period. Unlike the rent, a date before
 * the first period is never a fill: a fee may start mid-tenancy.
 */
export function validateTenancyPeriodDate(
  from: IsoDate,
  limits: { tenancy: RentDates; latestStart: IsoDate | undefined },
): RentDateProblem | undefined {
  const { tenancy, latestStart } = limits
  if (!from.endsWith('-01') && from !== tenancy.validFrom) {
    return 'amount_date_not_month_start'
  }
  if (from < tenancy.validFrom) {
    return 'rent_date_before_tenancy'
  }
  if (tenancy.validTo !== null && from > tenancy.validTo) {
    return 'rent_date_after_tenancy'
  }
  if (latestStart !== undefined && from < latestStart) {
    return 'amount_date_too_early'
  }
  return undefined
}

/**
 * A rent dated before the first period's start adds a period from that
 * date to the day before the first period, instead of a change.
 */
export function fillsBeforeFirst(
  from: IsoDate,
  firstStart: IsoDate | undefined,
): firstStart is IsoDate {
  return firstStart !== undefined && from < firstStart
}

/**
 * The rent the new tenant form suggests: the latest rent of the flat's
 * tenancy that starts last before `start`, or none.
 */
export function suggestedRent(
  tenancies: readonly {
    validFrom: IsoDate
    rents: readonly Period<number>[]
  }[],
  start: IsoDate,
): number | undefined {
  let previous: (typeof tenancies)[number] | undefined
  for (const tenancy of tenancies) {
    if (
      tenancy.validFrom < start &&
      (previous === undefined || tenancy.validFrom > previous.validFrom)
    ) {
      previous = tenancy
    }
  }
  return previous?.rents.at(-1)?.value
}

/**
 * Where a corrected start leaves the first period of a tenancy's rent,
 * occupants or a fee: moved to the new start when it started on the old one
 * or the new start is after it, else where it is (`move` null). A start on
 * or after the second period's start is refused.
 */
export function firstPeriodMove<T>(
  periods: readonly Period<T>[],
  oldStart: IsoDate,
  newStart: IsoDate,
): { ok: true; move: { from: IsoDate; to: IsoDate } | null } | { ok: false } {
  const first = periods.at(0)
  const second = periods.at(1)
  if (second !== undefined && newStart >= second.validFrom) {
    return { ok: false }
  }
  if (
    first === undefined ||
    first.validFrom === newStart ||
    (first.validFrom !== oldStart && newStart < first.validFrom)
  ) {
    return { ok: true, move: null }
  }
  return { ok: true, move: { from: first.validFrom, to: newStart } }
}

/** `firstPeriodMove` for the rent, with the rent's reason. */
export function firstRentMove(
  rents: readonly Period<number>[],
  oldStart: IsoDate,
  newStart: IsoDate,
):
  | { ok: true; move: { from: IsoDate; to: IsoDate } | null }
  | { ok: false; reason: 'tenancy_start_after_rent_change' } {
  const moved = firstPeriodMove(rents, oldStart, newStart)
  return moved.ok
    ? moved
    : { ok: false, reason: 'tenancy_start_after_rent_change' }
}

/** A last day before the latest period's start would leave it outside. */
export function periodAfterEnd<T>(
  periods: readonly Period<T>[],
  lastDay: IsoDate | null,
): boolean {
  const latest = periods.at(-1)
  return lastDay !== null && latest !== undefined && latest.validFrom > lastDay
}

/** `periodAfterEnd` for the rent. */
export function rentAfterEnd(
  rents: readonly Period<number>[],
  lastDay: IsoDate | null,
): boolean {
  return periodAfterEnd(rents, lastDay)
}
