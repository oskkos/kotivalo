// A flat's year for one user as form 7H rows (openspec: year-summary). Pure
// functions over plain values: nothing is stored, and the rules of each
// feature are reused, not copied (a month's charges, usage charges, the
// category's row, the split on a date). Every amount counts at the user's
// share on the date that decides it (the cash basis); a part is rounded to
// the cent once, from the exact sum.
import { sharesOn, type Period } from '#/features/ownership/periods'
import {
  chargeMonth,
  type ChargePeriods,
} from '#/features/recurring-amounts/charges'
import {
  monthOf,
  type Month,
  type Period as ValuePeriod,
} from '#/features/recurring-amounts/periods'
import type { PaymentOfMonth } from '#/features/rent-payments/status'
import { CATEGORIES, type SummaryRow } from '#/features/transactions/categories'
import {
  usageChargesOfMonth,
  type OccupiedTenancy,
  type UsageChargePeriods,
} from '#/features/usage-charges/months'
import { USAGE_CHARGE_ROWS } from '#/features/usage-charges/rows'
import type { IsoDate } from '#/lib/dates'
import type {
  ChargeKind,
  FinancingTreatment,
  TransactionCategory,
} from '#/server/db/schema'

/** The form 7H rows the summary fills, in the order of the form. */
export const ROW_NUMBERS = ['2.1', '2.2', '2.3', '2.4', '2.5'] as const
export type RowNumber = (typeof ROW_NUMBERS)[number]

const ROW_OF: Record<SummaryRow | 'capital_charges', RowNumber> = {
  gross_rent: '2.1',
  maintenance_and_water: '2.2',
  capital_charges: '2.3',
  annual_repairs: '2.4',
  other_costs: '2.5',
}

/** What a part of a row is made of. */
export type PartKey =
  | 'rent_payments'
  | TransactionCategory
  | 'maintenance_charge'
  | 'financing_charge'
  // A usage charge of the kind, as the housing company charges it.
  | ChargeKind

export interface Part {
  key: PartKey
  /** The user's share of the part, cents. */
  cents: number
}

export interface Row {
  /** In the order of `PART_ORDER`, leaving out parts of 0. */
  parts: Part[]
  /** The parts' sum, cents. */
  cents: number
}

/** The order parts are shown in. */
const PART_ORDER: readonly PartKey[] = [
  'rent_payments',
  'tenant_water_charge',
  'other_income',
  'maintenance_charge',
  'water',
  'water_charge',
  'financing_charge',
  'annual_repair',
  'insurance',
  'other_expense',
  'parking',
  'sauna',
  'other',
]

/** An entry as the summary reads it. */
export interface SummaryEntry {
  category: TransactionCategory
  /** Positive, cents. */
  amount: number
  date: IsoDate
}

/** A tenancy as the summary reads it. */
export interface SummaryTenancy {
  id: string
  tenantName: string
  validFrom: IsoDate
  /** The last day; null while an open-ended tenancy runs. */
  validTo: IsoDate | null
  dueDay: number
  /** Occupants periods, for per-occupant usage charges. */
  occupants: readonly ValuePeriod<number>[]
}

/** One flat's data for a year, as plain values. */
export interface FlatYearInput {
  propertyId: string
  /** The flat's ownership periods, with everyone's shares. */
  ownership: readonly Period[]
  tenancies: readonly SummaryTenancy[]
  /** Payments of any month and date; the summary picks by payment date. */
  payments: readonly PaymentOfMonth[]
  /** The year's entries. */
  entries: readonly SummaryEntry[]
  charges: ChargePeriods
  treatments: readonly ValuePeriod<FinancingTreatment>[]
  usageCharges: readonly UsageChargePeriods[]
}

export interface FlatYear {
  propertyId: string
  /** The user had a share above 0 on some day of the year, up to today. */
  included: boolean
  rows: Record<RowNumber, Row>
  /** Counted in no row, at the user's share (cents). */
  outside: { capitalised: number; improvements: number }
}

const WHOLE = 10000

/** Rounds `sum of amount × basis points` to cents, halves up. */
const toCents = (weighted: number): number =>
  Math.floor((2 * weighted + WHOLE) / (2 * WHOLE))

const shareOn = (
  ownership: readonly Period[],
  userId: string,
  date: IsoDate,
): number =>
  sharesOn(ownership, date).find((share) => share.userId === userId)?.share ?? 0

const monthIn = (year: number, index: number): Month =>
  `${String(year)}-${String(index + 1).padStart(2, '0')}`

/** The months of the year counted: up to the current one in the current year. */
export function monthsCounted(year: number, today: IsoDate): Month[] {
  const current = monthOf(today)
  return Array.from({ length: 12 }, (_, i) => monthIn(year, i)).filter(
    (month) => month <= current,
  )
}

/** Whether the user had a share above 0 on some day of the year up to today. */
export function ownedInYear(
  ownership: readonly Period[],
  userId: string,
  year: number,
  today: IsoDate,
): boolean {
  const first = `${String(year)}-01-01`
  const last = `${String(year)}-12-31` < today ? `${String(year)}-12-31` : today
  return ownership.some(
    (period) =>
      period.shares.some((s) => s.userId === userId && s.share > 0) &&
      period.validFrom <= last &&
      (period.validTo === null || period.validTo >= first) &&
      first <= last,
  )
}

/** Sums of amount × basis points by part, then rounded once each. */
class Weighted {
  private readonly sums = new Map<PartKey, number>()

  add(key: PartKey, cents: number, basisPoints: number) {
    this.sums.set(key, (this.sums.get(key) ?? 0) + cents * basisPoints)
  }

  cents(key: PartKey): number {
    return toCents(this.sums.get(key) ?? 0)
  }

  parts(keys: readonly PartKey[]): Part[] {
    return PART_ORDER.filter((key) => keys.includes(key)).flatMap((key) => {
      const cents = this.cents(key)
      return cents > 0 ? [{ key, cents }] : []
    })
  }
}

const rowOf = (parts: Part[]): Row => ({
  parts,
  cents: parts.reduce((sum, part) => sum + part.cents, 0),
})

/** The flat's year for the user, on `today` (in Finland). */
export function flatYear(
  input: FlatYearInput,
  userId: string,
  year: number,
  today: IsoDate,
): FlatYear {
  const { ownership } = input
  const shareAt = (date: IsoDate) => shareOn(ownership, userId, date)
  const inYear = (date: IsoDate) => date.startsWith(`${String(year)}-`)
  const byRow = new Map<RowNumber, Weighted>(
    ROW_NUMBERS.map((row) => [row, new Weighted()]),
  )
  const rowKeys = new Map<RowNumber, Set<PartKey>>(
    ROW_NUMBERS.map((row) => [row, new Set()]),
  )
  const add = (row: RowNumber, key: PartKey, cents: number, date: IsoDate) => {
    byRow.get(row)?.add(key, cents, shareAt(date))
    rowKeys.get(row)?.add(key)
  }
  const outside = { capitalised: new Weighted(), improvements: new Weighted() }

  for (const payment of input.payments) {
    if (inYear(payment.paidOn)) {
      add('2.1', 'rent_payments', payment.amount, payment.paidOn)
    }
  }

  for (const entry of input.entries) {
    if (!inYear(entry.date)) {
      continue
    }
    const row = CATEGORIES[entry.category].row
    if (row === null) {
      outside.improvements.add('improvement', entry.amount, shareAt(entry.date))
    } else {
      add(ROW_OF[row], entry.category, entry.amount, entry.date)
    }
  }

  const occupied: readonly OccupiedTenancy[] = input.tenancies
  for (const month of monthsCounted(year, today)) {
    const first = `${month}-01`
    const charged = chargeMonth(input.charges, input.treatments, month)
    for (const charge of charged?.charges ?? []) {
      if (charge.kind === 'maintenance_charge') {
        add('2.2', 'maintenance_charge', charge.cents, first)
      } else if (charged?.treatment === 'income_recognised') {
        add('2.3', 'financing_charge', charge.cents, first)
      } else if (charged?.treatment === 'capitalised') {
        outside.capitalised.add(
          'financing_charge',
          charge.cents,
          shareAt(first),
        )
      }
    }
    const used = usageChargesOfMonth(input.usageCharges, occupied, month)
    for (const charge of used?.charges ?? []) {
      add(
        ROW_OF[USAGE_CHARGE_ROWS[charge.kind]],
        charge.kind,
        charge.cents,
        first,
      )
    }
  }

  return {
    propertyId: input.propertyId,
    included: ownedInYear(ownership, userId, year, today),
    rows: Object.fromEntries(
      ROW_NUMBERS.map((row) => [
        row,
        rowOf(byRow.get(row)?.parts([...(rowKeys.get(row) ?? [])]) ?? []),
      ]),
    ) as Record<RowNumber, Row>,
    outside: {
      capitalised: outside.capitalised.cents('financing_charge'),
      improvements: outside.improvements.cents('improvement'),
    },
  }
}

/** The first year of each period's share above 0 up to the current year. */
export function summaryYears(
  ownership: readonly Period[],
  userId: string,
  today: IsoDate,
): number[] {
  const starts = ownership
    .filter(
      (period) =>
        period.validFrom <= today &&
        period.shares.some((s) => s.userId === userId && s.share > 0),
    )
    .map((period) => Number(period.validFrom.slice(0, 4)))
  if (starts.length === 0) {
    return []
  }
  const current = Number(today.slice(0, 4))
  const first = Math.min(...starts)
  return Array.from({ length: current - first + 1 }, (_, i) => first + i)
}

/**
 * The year to open: the previous year from January to June, the current year
 * from July, within the years; before the first of them, the first.
 */
export function openingYear(years: readonly number[], today: IsoDate): number {
  const current = Number(today.slice(0, 4))
  const wanted = Number(today.slice(5, 7)) <= 6 ? current - 1 : current
  return clampYear(years, wanted)
}

/** The nearest year in the range; the year itself when there is no range. */
export function clampYear(years: readonly number[], year: number): number {
  const first = years.at(0)
  const last = years.at(-1)
  if (first === undefined || last === undefined) {
    return year
  }
  return Math.min(Math.max(year, first), last)
}
