// A flat's charges month by month and by year (openspec: recurring-amounts,
// "Charges of a month"): the maintenance charge and each financing charge.
// Pure functions over the periods: nothing is stored, so a corrected period
// corrects every month computed from it.
import type { IsoDate } from '#/lib/dates'
import type { FinancingTreatment } from '#/server/db/schema'
import { monthOf, valueInMonth, type Month, type Period } from './periods'

/** The periods a year's charges are computed from. The rent is not a charge. */
export interface ChargePeriods {
  maintenance: readonly Period<number>[]
  /** The flat's financing charges, in the order they are shown. */
  financing: readonly {
    id: string
    name: string | null
    periods: readonly Period<number>[]
  }[]
}

/** A charge's treatment for the year's sums: `not_set` without one. */
export type TreatmentKey = FinancingTreatment | 'not_set'

export const TREATMENT_KEYS: readonly TreatmentKey[] = [
  'income_recognised',
  'capitalised',
  'not_set',
]

/** One charge in a month: the maintenance charge or a financing charge. */
export interface MonthCharge {
  /** `maintenance` or the financing charge's id. */
  key: string
  kind: 'maintenance_charge' | 'financing_charge'
  /** A financing charge's name; null for the unnamed one and maintenance. */
  name: string | null
  cents: number
  /** The month before's amount, when both are above 0 and differ. */
  previous?: number
  /** A financing charge's first month, after a month with charges. */
  started?: true
  /** A financing charge's first month at 0 after one above it. */
  ended?: true
}

export interface ChargeMonth {
  month: Month
  /** The charges set in the month, maintenance first. */
  charges: MonthCharge[]
  /** The financing charges' treatment on the month's first day. */
  treatment: FinancingTreatment | undefined
  total: number
}

/** A financing charge's sum in a year under one treatment. */
export interface FinancingLine {
  chargeId: string
  name: string | null
  treatment: TreatmentKey
  cents: number
}

export interface ChargeYear {
  year: number
  /** Newest first, only months with a charge set. */
  months: ChargeMonth[]
  maintenance: number
  /** Per financing charge and treatment, leaving out sums of 0. */
  financing: FinancingLine[]
  total: number
  /** The whole year with the periods as they are now; current year before December only. */
  estimate: number | undefined
}

interface Sequence {
  key: string
  kind: MonthCharge['kind']
  name: string | null
  periods: readonly Period<number>[]
}

function sequencesOf(periods: ChargePeriods): Sequence[] {
  return [
    {
      key: 'maintenance',
      kind: 'maintenance_charge',
      name: null,
      periods: periods.maintenance,
    },
    ...periods.financing.map((charge) => ({
      key: charge.id,
      kind: 'financing_charge' as const,
      name: charge.name,
      periods: charge.periods,
    })),
  ]
}

const yearOf = (date: IsoDate): number => Number(date.slice(0, 4))

const monthIn = (year: number, index: number): Month =>
  `${String(year)}-${String(index + 1).padStart(2, '0')}`

function monthBefore(month: Month): Month {
  const [year, m] = month.split('-').map(Number) as [number, number]
  return m === 1 ? monthIn(year - 1, 11) : monthIn(year, m - 2)
}

/** A month's charges, or undefined when none is set. */
export function chargeMonth(
  periods: ChargePeriods,
  treatments: readonly Period<FinancingTreatment>[],
  month: Month,
): ChargeMonth | undefined {
  const sequences = sequencesOf(periods)
  const before = monthBefore(month)
  const anyBefore = sequences.some(
    (sequence) => valueInMonth(sequence.periods, before) !== undefined,
  )
  const charges: MonthCharge[] = []
  for (const { key, kind, name, periods: own } of sequences) {
    const cents = valueInMonth(own, month)
    if (cents === undefined) {
      continue
    }
    const previous = valueInMonth(own, before)
    const charge: MonthCharge = { key, kind, name, cents }
    if (previous !== undefined && previous > 0 && cents > 0) {
      if (previous !== cents) {
        charge.previous = previous
      }
    }
    if (kind === 'financing_charge') {
      const first = own.at(0)
      if (first && monthOf(first.validFrom) === month && anyBefore) {
        charge.started = true
      }
      if (cents === 0 && previous !== undefined && previous > 0) {
        charge.ended = true
      }
    }
    charges.push(charge)
  }
  if (charges.length === 0) {
    return undefined
  }
  return {
    month,
    charges,
    treatment: valueInMonth(treatments, month),
    total: charges.reduce((sum, charge) => sum + charge.cents, 0),
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
  // Per charge id, then treatment.
  const sums = new Map<string, Partial<Record<TreatmentKey, number>>>()
  for (const month of monthsOf(year, today)) {
    const row = chargeMonth(periods, treatments, month)
    if (!row) {
      continue
    }
    months.unshift(row)
    for (const charge of row.charges) {
      if (charge.kind === 'maintenance_charge') {
        maintenance += charge.cents
        continue
      }
      const key: TreatmentKey = row.treatment ?? 'not_set'
      const sum = sums.get(charge.key) ?? {}
      sum[key] = (sum[key] ?? 0) + charge.cents
      sums.set(charge.key, sum)
    }
  }
  const financing = periods.financing.flatMap((charge) =>
    TREATMENT_KEYS.flatMap((treatment) => {
      const cents = sums.get(charge.id)?.[treatment] ?? 0
      return cents > 0
        ? [{ chargeId: charge.id, name: charge.name, treatment, cents }]
        : []
    }),
  )
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
    for (const sequence of sequencesOf(periods)) {
      total += valueInMonth(sequence.periods, monthIn(year, i)) ?? 0
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
  const starts = sequencesOf(periods)
    .flatMap((sequence) => sequence.periods.map((p) => p.validFrom))
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
