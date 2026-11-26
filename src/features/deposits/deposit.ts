// A tenancy's deposit and its return (openspec: deposits). Pure: the rent
// kept is allocated to the months with rent missing, the amount returned
// computed, the deadline and the reminder worked out from the dates; nothing
// here is stored.
import { addDays, type IsoDate } from '#/lib/dates'
import { monthOf, type Month } from '#/features/recurring-amounts/periods'
import {
  rentMonth,
  tenancyMonths,
  type AmountsData,
  type PaymentOfMonth,
  type RentTenancy,
} from '#/features/rent-payments/status'

/** The days after the contract's end within which a deposit is settled. */
export const RETURN_DAYS = 14

/** The most a deposit may be, in months' rent (Act on Residential Leases § 8). */
export const MAX_DEPOSIT_MONTHS = 3

/** A month of a tenancy with rent missing. */
export interface MissingMonth {
  month: Month
  /** Cents, above zero. */
  missing: number
}

/**
 * The months of the tenancy, from its start to its last rent day, whose
 * payments are less than their expected rent, oldest first. `payments` are
 * the tenancy's payments to count: a correction leaves out the return's own.
 */
export function missingRent(
  tenancy: RentTenancy & { validTo: IsoDate },
  data: AmountsData & { payments: readonly PaymentOfMonth[] },
): MissingMonth[] {
  return tenancyMonths(
    tenancy,
    monthOf(tenancy.validFrom),
    monthOf(tenancy.validTo),
  )
    .map((month) =>
      rentMonth(tenancy, month, { ...data, today: tenancy.validTo }),
    )
    .flatMap((row) =>
      row.missing === undefined || row.missing === 0
        ? []
        : [{ month: row.month, missing: row.missing }],
    )
}

export type AllocationResult =
  | { ok: true; payments: { month: Month; amount: number }[] }
  | { ok: false; reason: 'deposit_rent_exceeds_unpaid' }

/**
 * Spreads the rent kept over the months with rent missing, oldest first,
 * each up to its missing amount. Refused when it is more than all of them.
 */
export function allocateRentKept(
  months: readonly MissingMonth[],
  kept: number,
): AllocationResult {
  const payments: { month: Month; amount: number }[] = []
  let left = kept
  for (const { month, missing } of months) {
    if (left === 0) {
      break
    }
    const amount = Math.min(left, missing)
    payments.push({ month, amount })
    left -= amount
  }
  return left > 0
    ? { ok: false, reason: 'deposit_rent_exceeds_unpaid' }
    : { ok: true, payments }
}

/** What is paid back: the deposit less the amounts kept, in cents. */
export function amountReturned(
  deposit: number,
  kept: { rentKept: number; damageKept: number },
): number {
  return deposit - kept.rentKept - kept.damageKept
}

export type ReturnReason =
  | 'deposit_not_set'
  | 'deposit_return_exists'
  | 'deposit_return_before_end'
  | 'deposit_return_date_in_future'
  | 'deposit_kept_exceeds_deposit'
  | 'deposit_kept_required'
  | 'deposit_note_too_long'

export const NOTE_MAX = 200

export interface ReturnInput {
  deposit: number | null
  /** The tenancy's last rent day; null while it has none. */
  lastRentDay: IsoDate | null
  hasReturn: boolean
  returnedOn: IsoDate
  /** With deductions (*Vähennyksin*): then something has to be kept. */
  deductions: boolean
  rentKept: number
  damageKept: number
  note: string | null
  today: IsoDate
}

/**
 * The first rule a new return breaks, or null. Access, the tenancy's
 * existence and the rent missing are checked elsewhere.
 */
export function checkReturn(input: ReturnInput): ReturnReason | null {
  if (input.deposit === null || input.lastRentDay === null) {
    return 'deposit_not_set'
  }
  if (input.hasReturn) {
    return 'deposit_return_exists'
  }
  return checkReturnFields({ ...input, deposit: input.deposit })
}

/** The rules a recorded return keeps too, when it is corrected. */
export function checkReturnFields(
  input: Omit<ReturnInput, 'deposit' | 'hasReturn'> & { deposit: number },
): ReturnReason | null {
  if (input.lastRentDay !== null && input.returnedOn < input.lastRentDay) {
    return 'deposit_return_before_end'
  }
  if (input.returnedOn > input.today) {
    return 'deposit_return_date_in_future'
  }
  if (input.rentKept + input.damageKept > input.deposit) {
    return 'deposit_kept_exceeds_deposit'
  }
  if (input.deductions && input.rentKept + input.damageKept === 0) {
    return 'deposit_kept_required'
  }
  if (input.note !== null && input.note.length > NOTE_MAX) {
    return 'deposit_note_too_long'
  }
  return null
}

/** The last day to return the deposit or notify its keeping. */
export function returnDeadline(lastRentDay: IsoDate): IsoDate {
  return addDays(lastRentDay, RETURN_DAYS)
}

/** The most the law allows, when the deposit is above it; else null. */
export function depositOverLimit(
  deposit: number,
  monthlyRent: number,
): number | null {
  const limit = MAX_DEPOSIT_MONTHS * monthlyRent
  return deposit > limit ? limit : null
}

export interface DepositTenancy {
  id: string
  validTo: IsoDate | null
  deposit: number | null
}

/**
 * The tenancies whose deposit is not returned although their last rent day
 * has come: a deposit, no return, a last rent day of today or earlier. In the
 * order given.
 */
export function pendingReturns<T extends DepositTenancy>(
  tenancies: readonly T[],
  returned: ReadonlySet<string>,
  today: IsoDate,
): T[] {
  return tenancies.filter(
    (tenancy) =>
      tenancy.deposit !== null &&
      tenancy.deposit > 0 &&
      !returned.has(tenancy.id) &&
      tenancy.validTo !== null &&
      tenancy.validTo <= today,
  )
}
