// A flat's charges month by month and by year (openspec: recurring-amounts,
// "Charges of a month"). Pure functions over the periods: nothing is
// stored, so a corrected period corrects every month computed from it.
import type { IsoDate } from '#/lib/dates'
import type {
  FinancingTreatment,
  RecurringAmountKind,
} from '#/server/db/schema'
import { monthOf, valueInMonth, type Month, type Period } from './periods'

/** The charges: the rent is not one. */
export type ChargeKind = Exclude<RecurringAmountKind, 'rent'>

export const CHARGE_KINDS: readonly ChargeKind[] = [
  'maintenance_charge',
  'financing_charge',
]

/** The periods a year's charges are computed from. */
export type ChargePeriods = Record<ChargeKind, readonly Period<number>[]>

/** A charge's treatment for the year's sums: `not_set` without one. */
export type TreatmentKey = FinancingTreatment | 'not_set'

export interface MonthCharge {
  cents: number
  /** The month before's amount, when it was set and differs. */
  previous?: number
}

export interface ChargeMonth {
  month: Month
  /** Per charge; a charge not set in the month is left out. */
  charges: Partial<Record<ChargeKind, MonthCharge>>
  /** The financing charge's treatment on the month's first day. */
  treatment: FinancingTreatment | undefined
  total: number
}

export interface ChargeYear {
  year: number
  /** Newest first, only months with a charge set. */
  months: ChargeMonth[]
  maintenance: number
  /** The financing charge's sums by the month's treatment. */
  financing: Partial<Record<TreatmentKey, number>>
  total: number
  /** The whole year with the periods as they are now; current year before December only. */
  estimate: number | undefined
}

const yearOf = (date: IsoDate): number => Number(date.slice(0, 4))

const monthIn = (year: number, index: number): Month =>
  `${String(year)}-${String(index + 1).padStart(2, '0')}`

function monthBefore(month: Month): Month {
  const [year, m] = month.split('-').map(Number) as [number, number]
  return m === 1 ? monthIn(year - 1, 11) : monthIn(year, m - 2)
}

/** A month's charges, or undefined when neither is set. */
export function chargeMonth(
  periods: ChargePeriods,
  treatments: readonly Period<FinancingTreatment>[],
  month: Month,
): ChargeMonth | undefined {
  const charges: Partial<Record<ChargeKind, MonthCharge>> = {}
  let total = 0
  for (const kind of CHARGE_KINDS) {
    const cents = valueInMonth(periods[kind], month)
    if (cents === undefined) {
      continue
    }
    const before = valueInMonth(periods[kind], monthBefore(month))
    charges[kind] =
      before !== undefined && before !== cents
        ? { cents, previous: before }
        : { cents }
    total += cents
  }
  if (Object.keys(charges).length === 0) {
    return undefined
  }
  return {
    month,
    charges,
    treatment: valueInMonth(treatments, month),
    total,
  }
}

/** The months of a year to count: up to the current month in the current year. */
function monthsOf(year: number, today: IsoDate): Month[] {
  const current = monthOf(today)
  return Array.from({ length: 12 }, (_, i) => monthIn(year, i)).filter(
    (month) => month <= current,
  )
}

/** A year's charges, newest month first. */
export function chargesOfYear(
  periods: ChargePeriods,
  treatments: readonly Period<FinancingTreatment>[],
  year: number,
  today: IsoDate,
): ChargeYear {
  const months: ChargeMonth[] = []
  let maintenance = 0
  const financing: Partial<Record<TreatmentKey, number>> = {}
  for (const month of monthsOf(year, today)) {
    const row = chargeMonth(periods, treatments, month)
    if (!row) {
      continue
    }
    months.unshift(row)
    maintenance += row.charges.maintenance_charge?.cents ?? 0
    const fin = row.charges.financing_charge
    if (fin) {
      const key: TreatmentKey = row.treatment ?? 'not_set'
      financing[key] = (financing[key] ?? 0) + fin.cents
    }
  }
  const isCurrent = year === yearOf(today) && monthOf(today) < monthIn(year, 11)
  return {
    year,
    months,
    maintenance,
    financing,
    total: months.reduce((sum, row) => sum + row.total, 0),
    estimate: isCurrent ? wholeYear(periods, year) : undefined,
  }
}

function wholeYear(periods: ChargePeriods, year: number): number {
  let total = 0
  for (let i = 0; i < 12; i++) {
    for (const kind of CHARGE_KINDS) {
      total += valueInMonth(periods[kind], monthIn(year, i)) ?? 0
    }
  }
  return total
}

/**
 * The years with charges, newest first: the current year and every earlier
 * one from the first charge period's year. Empty when no charge is set in
 * any month up to the current one.
 */
export function chargeYears(periods: ChargePeriods, today: IsoDate): number[] {
  const starts = CHARGE_KINDS.flatMap((kind) =>
    periods[kind].map((p) => p.validFrom),
  )
    .filter((from) => from <= today)
    .sort()
  const first = starts.at(0)
  if (first === undefined) {
    return []
  }
  const current = yearOf(today)
  return Array.from(
    { length: current - yearOf(first) + 1 },
    (_, i) => current - i,
  )
}
