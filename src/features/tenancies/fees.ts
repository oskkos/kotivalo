// A tenancy's occupants and tenant fees in a month (openspec: tenancies,
// "Occupants of a tenancy", "Tenant fees are recorded as periods"). Pure: no
// database access. Prorating by days is the rent payments' business
// (`rent-payments/status.ts`); these are the full monthly amounts.
import type { Month, Period } from '#/features/recurring-amounts/periods'
import type { IsoDate } from '#/lib/dates'
import type { ChargeBasis, ChargeKind } from '#/server/db/schema'
import { valueInTenancyMonth, type RentDates } from './rent'

/** What the fee calculations need of a tenancy. */
export type FeeTenancy = Pick<RentDates, 'validFrom'>

/** What the fee calculations need of a fee. */
export interface FeeAmounts {
  basis: ChargeBasis
  /** Cents per month or per occupant per month, oldest first. */
  amounts: readonly Period<number>[]
}

/** A tenant fee as the rent calculations and the pages read it. */
export interface FeeOfTenancy extends FeeAmounts {
  id: string
  kind: ChargeKind
  /** Set for the kind `other`. */
  description: string | null
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

/** A tenancy with its tenant fees, for offering them to the next one. */
export interface TenancyWithFees {
  id: string
  validFrom: IsoDate
  /** The last day; null while an open-ended tenancy runs. */
  validTo: IsoDate | null
  fees: readonly FeeOfTenancy[]
}

/** A fee offered to the next tenancy, with the amount it carries over. */
export interface OfferedFee {
  fee: FeeOfTenancy
  /** Cents: the amount in force on the previous tenancy's last day. */
  amount: number
}

/**
 * The fees of the tenancy that starts last before `start` that aren't ended
 * on its last day (openspec: tenancies, "Occupants and fees of a new
 * tenancy"), each with the amount it carries over.
 */
export function offeredFees(
  tenancies: readonly TenancyWithFees[],
  start: IsoDate,
): OfferedFee[] {
  let previous: TenancyWithFees | undefined
  for (const tenancy of tenancies) {
    if (
      tenancy.validFrom < start &&
      (previous === undefined || tenancy.validFrom > previous.validFrom)
    ) {
      previous = tenancy
    }
  }
  if (previous === undefined) {
    return []
  }
  const lastDay = previous.validTo
  return previous.fees.flatMap((fee) => {
    const inForce = fee.amounts
      .filter((p) => lastDay === null || p.validFrom <= lastDay)
      .at(-1)
    return inForce !== undefined && inForce.value > 0
      ? [{ fee, amount: inForce.value }]
      : []
  })
}
