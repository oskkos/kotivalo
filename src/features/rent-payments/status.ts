// A month's expected rent and rent status for a tenancy (openspec:
// rent-payments, "Expected rent of a month", "The rent status of a month",
// "Months not fully paid"). Pure: computed from the flat's rent periods, the
// tenancy's dates and due day, and the recorded payments; never stored.
import {
  addMonths,
  daysBetween,
  daysInMonth,
  lastDayOfMonth,
  type IsoDate,
} from '#/lib/dates'
import {
  monthOf,
  valueInMonth,
  type Month,
  type Period,
} from '#/features/recurring-amounts/periods'
import { dueDate } from '#/features/tenancies/status'

export interface RentTenancy {
  id: string
  validFrom: IsoDate
  /** The last day; null while an open-ended tenancy runs. */
  validTo: IsoDate | null
  dueDay: number
}

export interface PaymentOfMonth {
  tenancyId: string
  month: Month
  /** Cents. */
  amount: number
  paidOn: IsoDate
}

export type RentStatus =
  | { kind: 'paid'; on: IsoDate }
  | { kind: 'partly_paid'; missing: number }
  | { kind: 'late'; days: number }
  | { kind: 'due'; on: IsoDate }
  | { kind: 'rent_not_set' }

const later = (a: IsoDate, b: IsoDate): IsoDate => (a > b ? a : b)
const earlier = (a: IsoDate, b: IsoDate): IsoDate => (a < b ? a : b)

/** The days of `month` on which the tenancy runs. */
function daysRun(tenancy: RentTenancy, month: Month): number {
  const first = later(tenancy.validFrom, `${month}-01`)
  const monthEnd = lastDayOfMonth(month)
  const last =
    tenancy.validTo === null ? monthEnd : earlier(tenancy.validTo, monthEnd)
  return Math.max(0, daysBetween(first, last) + 1)
}

/**
 * The month's rent in proportion to the days the tenancy runs, rounded to
 * the cent, halves up; undefined when no rent is in effect in the month.
 */
export function expectedRent(
  rentPeriods: readonly Period<number>[],
  tenancy: RentTenancy,
  month: Month,
): number | undefined {
  const rent = valueInMonth(rentPeriods, month)
  if (rent === undefined) {
    return undefined
  }
  const days = daysRun(tenancy, month)
  const all = daysInMonth(month)
  if (days === all) {
    return rent
  }
  // Integer arithmetic: floor(rent × days ÷ all + ½).
  return Math.floor((2 * rent * days + all) / (2 * all))
}

/** The due date in `month`: the due day, but no earlier than the start. */
export function rentDueDate(tenancy: RentTenancy, month: Month): IsoDate {
  return later(dueDate(tenancy.dueDay, month), tenancy.validFrom)
}

/** The status of a month with these payments on `today`. */
export function monthStatus(month: {
  expected: number | undefined
  payments: readonly Pick<PaymentOfMonth, 'amount' | 'paidOn'>[]
  dueDate: IsoDate
  today: IsoDate
}): RentStatus {
  const { expected, payments, today } = month
  if (expected === undefined) {
    return { kind: 'rent_not_set' }
  }
  if (payments.length > 0) {
    const paid = payments.reduce((sum, payment) => sum + payment.amount, 0)
    if (paid >= expected) {
      const on = payments
        .map((payment) => payment.paidOn)
        .reduce((a, b) => later(a, b))
      return { kind: 'paid', on }
    }
    return { kind: 'partly_paid', missing: expected - paid }
  }
  return today > month.dueDate
    ? { kind: 'late', days: daysBetween(month.dueDate, today) }
    : { kind: 'due', on: month.dueDate }
}

/** The months from `from` to `to` (inclusive) in which the tenancy runs. */
export function tenancyMonths(
  tenancy: RentTenancy,
  from: Month,
  to: Month,
): Month[] {
  const first = later(monthOf(tenancy.validFrom), from)
  const last =
    tenancy.validTo === null ? to : earlier(monthOf(tenancy.validTo), to)
  const months: Month[] = []
  for (let month = first; month <= last; month = addMonths(month, 1)) {
    months.push(month)
  }
  return months
}

/** One month of one tenancy, with everything its status is made of. */
export interface RentMonth<T extends RentTenancy = RentTenancy> {
  tenancy: T
  month: Month
  expected: number | undefined
  /** Cents paid so far. */
  paid: number
  /** What's still missing, never below zero; undefined without a rent. */
  missing: number | undefined
  dueDate: IsoDate
  status: RentStatus
}

/** A month of a tenancy and its status on `today`. */
export function rentMonth<T extends RentTenancy>(
  tenancy: T,
  month: Month,
  data: {
    rentPeriods: readonly Period<number>[]
    payments: readonly PaymentOfMonth[]
    today: IsoDate
  },
): RentMonth<T> {
  const payments = data.payments.filter(
    (payment) => payment.tenancyId === tenancy.id && payment.month === month,
  )
  const expected = expectedRent(data.rentPeriods, tenancy, month)
  const due = rentDueDate(tenancy, month)
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0)
  return {
    tenancy,
    month,
    expected,
    paid,
    missing: expected === undefined ? undefined : Math.max(0, expected - paid),
    dueDate: due,
    status: monthStatus({
      expected,
      payments,
      dueDate: due,
      today: data.today,
    }),
  }
}

/**
 * The months of the tenancies from `from` to `to`, newest first; two
 * tenancies in the same month give two rows, the later tenancy first.
 */
export function rentMonths<T extends RentTenancy>(data: {
  tenancies: readonly T[]
  rentPeriods: readonly Period<number>[]
  payments: readonly PaymentOfMonth[]
  from: Month
  to: Month
  today: IsoDate
}): RentMonth<T>[] {
  return data.tenancies
    .flatMap((tenancy) =>
      tenancyMonths(tenancy, data.from, data.to).map((month) =>
        rentMonth(tenancy, month, data),
      ),
    )
    .sort(
      (a, b) =>
        b.month.localeCompare(a.month) ||
        b.tenancy.validFrom.localeCompare(a.tenancy.validFrom),
    )
}

/**
 * The months of this and the previous calendar year, up to the current one,
 * that are late or partly paid on `today`, newest first.
 */
export function monthsNotFullyPaid<T extends RentTenancy>(data: {
  tenancies: readonly T[]
  rentPeriods: readonly Period<number>[]
  payments: readonly PaymentOfMonth[]
  today: IsoDate
}): RentMonth<T>[] {
  const year = Number(data.today.slice(0, 4))
  return rentMonths({
    ...data,
    from: `${String(year - 1)}-01`,
    to: monthOf(data.today),
  }).filter(
    (row) => row.status.kind === 'late' || row.status.kind === 'partly_paid',
  )
}
