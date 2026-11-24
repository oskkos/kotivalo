// A tenancy's occupants and tenant fees in a month (openspec: tenancies,
// "Occupants of a tenancy", "Tenant fees are recorded as periods"). Pure: no
// database access. Prorating by days is the rent payments' business
// (`rent-payments/status.ts`); these are the full monthly amounts.
import type { Month, Period } from '#/features/recurring-amounts/periods'
import { valueInTenancyMonth, type RentDates } from './rent'

/** What the fee calculations need of a tenancy. */
export type FeeTenancy = Pick<RentDates, 'validFrom'>

/** What the fee calculations need of a fee. */
export interface FeeAmounts {
  basis: 'fixed' | 'per_occupant'
  /** Cents per month or per occupant per month, oldest first. */
  amounts: readonly Period<number>[]
}

/** The persons living in the flat in `month`; undefined without a period. */
export function occupantsInMonth(
  occupants: readonly Period<number>[],
  tenancy: FeeTenancy,
  month: Month,
): number | undefined {
  return valueInTenancyMonth(occupants, tenancy, month)
}

/**
 * A fee's full monthly amount in `month`: the amount of its period on the
 * month's first day (or the tenancy's start day in the month it starts),
 * times the occupants for a per-occupant fee. Undefined when no amount is in
 * effect. A tenancy without occupants counts one.
 */
export function feeInMonth(
  fee: FeeAmounts,
  occupants: readonly Period<number>[],
  tenancy: FeeTenancy,
  month: Month,
): number | undefined {
  const amount = valueInTenancyMonth(fee.amounts, tenancy, month)
  if (amount === undefined) {
    return undefined
  }
  return fee.basis === 'per_occupant'
    ? amount * (occupantsInMonth(occupants, tenancy, month) ?? 1)
    : amount
}
