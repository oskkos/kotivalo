// A flat's usage charges month by month and by year (openspec: usage-charges,
// "Usage charges of a month"). Pure functions over the periods and the
// tenancies' occupants: nothing is stored. A per-occupant charge multiplies
// by the occupants of the tenancy running on the month's first day, or one
// while the flat is vacant. Amounts are not divided by days.
import {
  monthOf,
  periodOn,
  valueInMonth,
  type Month,
  type Period,
} from '#/features/recurring-amounts/periods'
import type { IsoDate } from '#/lib/dates'
import type { ChargeBasis, ChargeKind } from '#/server/db/schema'

/** A usage charge with its amount periods, oldest first. */
export interface UsageChargePeriods {
  id: string
  kind: ChargeKind
  basis: ChargeBasis
  /** Set for the kind `other`. */
  description: string | null
  periods: readonly Period<number>[]
}

/** A tenancy's dates and occupants, for the per-occupant amounts. */
export interface OccupiedTenancy {
  validFrom: IsoDate
  /** The last day; null while an open-ended tenancy runs. */
  validTo: IsoDate | null
  occupants: readonly Period<number>[]
}

/** One usage charge in a month. */
export interface MonthUsageCharge {
  id: string
  kind: ChargeKind
  description: string | null
  basis: ChargeBasis
  /** The month's amount: the period's, times the occupants per occupant. */
  cents: number
  /** The occupants counted, for a per-occupant charge; else null. */
  persons: number | null
  /** The period's amount: per occupant for a per-occupant charge. */
  perUnit: number
  /** The month before's amount, when both are above 0 and differ. */
  previous?: number
}

export interface UsageChargeMonth {
  month: Month
  charges: MonthUsageCharge[]
  total: number
}

export interface UsageChargeYear {
  year: number
  /** Newest first, only months with a usage charge. */
  months: UsageChargeMonth[]
  /** Per usage charge, leaving out sums of 0, in the charges' order. */
  sums: {
    id: string
    kind: ChargeKind
    description: string | null
    cents: number
  }[]
  total: number
}

/**
 * The occupants on `day`: those of the tenancy running then, or one when no
 * tenancy runs (a vacant flat).
 */
export function occupantsOn(
  tenancies: readonly OccupiedTenancy[],
  day: IsoDate,
): number {
  const running = tenancies.find(
    (t) => t.validFrom <= day && (t.validTo === null || day <= t.validTo),
  )
  return running ? (periodOn(running.occupants, day)?.value ?? 1) : 1
}

function amountIn(
  charge: UsageChargePeriods,
  tenancies: readonly OccupiedTenancy[],
  month: Month,
): Omit<MonthUsageCharge, 'previous'> | undefined {
  const perUnit = valueInMonth(charge.periods, month)
  if (perUnit === undefined) {
    return undefined
  }
  const persons =
    charge.basis === 'per_occupant'
      ? occupantsOn(tenancies, `${month}-01`)
      : null
  return {
    id: charge.id,
    kind: charge.kind,
    description: charge.description,
    basis: charge.basis,
    perUnit,
    persons,
    cents: perUnit * (persons ?? 1),
  }
}

const monthIn = (year: number, index: number): Month =>
  `${String(year)}-${String(index + 1).padStart(2, '0')}`

function monthBefore(month: Month): Month {
  const [year, m] = month.split('-').map(Number) as [number, number]
  return m === 1 ? monthIn(year - 1, 11) : monthIn(year, m - 2)
}

/** A month's usage charges, or undefined when none has an amount. */
export function usageChargesOfMonth(
  charges: readonly UsageChargePeriods[],
  tenancies: readonly OccupiedTenancy[],
  month: Month,
): UsageChargeMonth | undefined {
  const before = monthBefore(month)
  const rows: MonthUsageCharge[] = []
  for (const charge of charges) {
    const row: MonthUsageCharge | undefined = amountIn(charge, tenancies, month)
    if (row === undefined) {
      continue
    }
    const previous = amountIn(charge, tenancies, before)?.cents
    if (
      previous !== undefined &&
      previous > 0 &&
      row.cents > 0 &&
      previous !== row.cents
    ) {
      row.previous = previous
    }
    rows.push(row)
  }
  if (rows.length === 0) {
    return undefined
  }
  return {
    month,
    charges: rows,
    total: rows.reduce((sum, row) => sum + row.cents, 0),
  }
}

/** A year's usage charges, up to the current month in the current year. */
export function usageChargesOfYear(
  charges: readonly UsageChargePeriods[],
  tenancies: readonly OccupiedTenancy[],
  year: number,
  today: IsoDate,
): UsageChargeYear {
  const current = monthOf(today)
  const months: UsageChargeMonth[] = []
  const sums = new Map<string, number>()
  for (let i = 0; i < 12; i++) {
    const month = monthIn(year, i)
    if (month > current) {
      break
    }
    const row = usageChargesOfMonth(charges, tenancies, month)
    if (!row) {
      continue
    }
    months.unshift(row)
    for (const charge of row.charges) {
      sums.set(charge.id, (sums.get(charge.id) ?? 0) + charge.cents)
    }
  }
  return {
    year,
    months,
    sums: charges.flatMap((charge) => {
      const cents = sums.get(charge.id) ?? 0
      return cents > 0
        ? [
            {
              id: charge.id,
              kind: charge.kind,
              description: charge.description,
              cents,
            },
          ]
        : []
    }),
    total: months.reduce((sum, row) => sum + row.total, 0),
  }
}

/**
 * The years with usage charges, newest first: the current year and every
 * earlier one from the first period's year. Empty when no usage charge has an
 * amount in any month up to the current one.
 */
export function usageChargeYears(
  charges: readonly UsageChargePeriods[],
  today: IsoDate,
): number[] {
  const first = charges
    .flatMap((charge) => charge.periods.map((p) => p.validFrom))
    .filter((from) => from <= today)
    .sort()
    .at(0)
  if (first === undefined) {
    return []
  }
  const current = Number(today.slice(0, 4))
  const from = Number(first.slice(0, 4))
  return Array.from({ length: current - from + 1 }, (_, i) => current - i)
}
