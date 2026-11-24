// A month's expected rent and rent status for a tenancy (openspec:
// rent-payments, "Expected rent of a month", "The rent status of a month",
// "Months not fully paid", "The rent summary on the flats list"). Pure:
// computed from each tenancy's own rent, occupants and tenant fee periods, its
// dates and due day, and the recorded payments; never stored.
import {
  addMonths,
  daysBetween,
  daysInMonth,
  lastDayOfMonth,
  type IsoDate,
} from '#/lib/dates'
import {
  monthOf,
  type Month,
  type Period,
} from '#/features/recurring-amounts/periods'
import {
  feeInMonth,
  occupantsInMonth,
  type FeeOfTenancy,
} from '#/features/tenancies/fees'
import { rentInMonth } from '#/features/tenancies/rent'
import type { ChargeKind } from '#/server/db/schema'
import {
  currentTenancy,
  dueDate,
  type StatusTenancy,
} from '#/features/tenancies/status'

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
  | { kind: 'nothing_to_pay' }
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

/** Each tenancy's rent periods by tenancy id, oldest first. */
export type RentsByTenancy = Partial<Record<string, readonly Period<number>[]>>

/** Each tenancy's occupants periods by tenancy id, oldest first. */
export type OccupantsByTenancy = RentsByTenancy

/** Each tenancy's tenant fees by tenancy id. */
export type FeesByTenancy = Partial<Record<string, readonly FeeOfTenancy[]>>

/** What a tenancy's expected rent is made of. */
export interface TenancyAmounts {
  rent: readonly Period<number>[]
  occupants: readonly Period<number>[]
  fees: readonly FeeOfTenancy[]
}

/** One part of a month's expected rent, prorated by days. */
export type RentPart =
  | { type: 'rent'; amount: number }
  | {
      type: 'fee'
      feeId: string
      kind: ChargeKind
      description: string | null
      /** The month's occupants for a per-occupant fee, else null. */
      persons: number | null
      amount: number
    }

/** The month's expected rent: the rent and the fees, and what makes it up. */
export interface ExpectedRent {
  /** Cents: the parts' sum. */
  total: number
  /** The rent first, then each fee in effect with an amount above zero. */
  parts: RentPart[]
}

/** The data every month calculation reads the amounts from. */
export interface AmountsData {
  rents: RentsByTenancy
  occupants?: OccupantsByTenancy
  fees?: FeesByTenancy
}

/** The tenancy's amounts out of the maps by tenancy id. */
export function amountsOf(
  data: AmountsData,
  tenancyId: string,
): TenancyAmounts {
  return {
    rent: data.rents[tenancyId] ?? [],
    occupants: data.occupants?.[tenancyId] ?? [],
    fees: data.fees?.[tenancyId] ?? [],
  }
}

/** `amount` in proportion to `days` of `all`, rounded to the cent, halves up. */
function prorate(amount: number, days: number, all: number): number {
  if (days === all) {
    return amount
  }
  // Integer arithmetic: floor(amount × days ÷ all + ½).
  return Math.floor((2 * amount * days + all) / (2 * all))
}

/**
 * The month's expected rent of the tenancy: its rent and its tenant fees from
 * its own periods, each in proportion to the days the tenancy runs, rounded
 * to the cent, halves up; null when the tenancy has no rent in the month.
 */
export function expectedRent(
  amounts: TenancyAmounts,
  tenancy: RentTenancy,
  month: Month,
): ExpectedRent | null {
  const rent = rentInMonth(amounts.rent, tenancy, month)
  if (rent === undefined) {
    return null
  }
  const days = daysRun(tenancy, month)
  const all = daysInMonth(month)
  const parts: RentPart[] = [{ type: 'rent', amount: prorate(rent, days, all) }]
  for (const fee of amounts.fees) {
    const full = feeInMonth(fee, amounts.occupants, tenancy, month)
    if (full === undefined || full === 0) {
      continue
    }
    parts.push({
      type: 'fee',
      feeId: fee.id,
      kind: fee.kind,
      description: fee.description,
      persons:
        fee.basis === 'per_occupant'
          ? (occupantsInMonth(amounts.occupants, tenancy, month) ?? 1)
          : null,
      amount: prorate(full, days, all),
    })
  }
  return {
    total: parts.reduce((sum, part) => sum + part.amount, 0),
    parts,
  }
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
  // A rent of 0 € is never late; a payment still shows the month as paid.
  if (expected === 0 && payments.length === 0) {
    return { kind: 'nothing_to_pay' }
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
  /** The month's expected rent and fees in cents; undefined without a rent. */
  expected: number | undefined
  /** What the expected amount is made of; empty without a rent. */
  parts: RentPart[]
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
  data: AmountsData & {
    payments: readonly PaymentOfMonth[]
    today: IsoDate
  },
): RentMonth<T> {
  const payments = data.payments.filter(
    (payment) => payment.tenancyId === tenancy.id && payment.month === month,
  )
  const expectation = expectedRent(amountsOf(data, tenancy.id), tenancy, month)
  const expected = expectation?.total
  const due = rentDueDate(tenancy, month)
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0)
  return {
    tenancy,
    month,
    expected,
    parts: expectation?.parts ?? [],
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
export function rentMonths<T extends RentTenancy>(
  data: AmountsData & {
    tenancies: readonly T[]
    payments: readonly PaymentOfMonth[]
    from: Month
    to: Month
    today: IsoDate
  },
): RentMonth<T>[] {
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
export function monthsNotFullyPaid<T extends RentTenancy>(
  data: AmountsData & {
    tenancies: readonly T[]
    payments: readonly PaymentOfMonth[]
    today: IsoDate
  },
): RentMonth<T>[] {
  const year = Number(data.today.slice(0, 4))
  return rentMonths({
    ...data,
    from: `${String(year - 1)}-01`,
    to: monthOf(data.today),
  }).filter(
    (row) => row.status.kind === 'late' || row.status.kind === 'partly_paid',
  )
}

/** One flat's data for this month's rent on the flats list. */
export interface FlatRentData<
  T extends RentTenancy & StatusTenancy,
> extends AmountsData {
  propertyId: string
  /** The tenancies that run in this month or later. */
  tenancies: readonly T[]
  /** The tenancies' rent periods. */
  /** At least this month's payments of the flat's tenancies. */
  payments: readonly PaymentOfMonth[]
}

export interface RentThisMonth<T extends RentTenancy> {
  /**
   * Each flat's card row by flat id: the current tenancy's month, as on the
   * details page's rent card; absent for a vacant flat and one whose
   * tenancy starts after this month.
   */
  rows: Partial<Record<string, RentMonth<T>>>
  /** Cents expected this month across the flats, whole rents. */
  expected: number
  /** Cents recorded for this month's rent across the flats. */
  received: number
  /** Flats whose card row is late. */
  late: number
  /** Whether any tenancy has a rent in effect this month. */
  hasRent: boolean
}

/**
 * This month's rent across the flats on `today`: the cards' rows and the
 * summary's totals. Every tenancy running in the month counts in the
 * totals, a tenancy without a rent in effect in neither.
 */
export function rentThisMonth<T extends RentTenancy & StatusTenancy>(
  flats: readonly FlatRentData<T>[],
  today: IsoDate,
): RentThisMonth<T> {
  const month = monthOf(today)
  const result: RentThisMonth<T> = {
    rows: {},
    expected: 0,
    received: 0,
    late: 0,
    hasRent: false,
  }
  for (const flat of flats) {
    const data = { ...flat, today }
    for (const row of rentMonths({ ...data, from: month, to: month })) {
      if (row.expected !== undefined) {
        result.hasRent = true
        result.expected += row.expected
        result.received += row.paid
      }
    }
    const current = currentTenancy(flat.tenancies, today)
    if (current && current.validFrom <= lastDayOfMonth(month)) {
      const row = rentMonth(current, month, data)
      result.rows[flat.propertyId] = row
      if (row.status.kind === 'late') {
        result.late += 1
      }
    }
  }
  return result
}
