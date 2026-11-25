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
import {
  rentMonths,
  tenancyMonths,
  type PaymentOfMonth,
} from '#/features/rent-payments/status'
import type { FeeOfTenancy } from '#/features/tenancies/fees'
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
  /** Occupants periods, for per-occupant usage charges and fees. */
  occupants: readonly ValuePeriod<number>[]
  /** The tenancy's rent periods and tenant fees, for the rent status. */
  rent: readonly ValuePeriod<number>[]
  fees: readonly FeeOfTenancy[]
}

/** The housing company details stored on the flat. */
export interface HousingCompany {
  name: string | null
  businessId: string | null
  apartmentNumber: string | null
}

/** One flat's data for a year, as plain values. */
export interface FlatYearInput {
  propertyId: string
  housingCompany: HousingCompany
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

/** The flat details form 7H asks for. */
export interface FlatDetails extends HousingCompany {
  tenant: { kind: 'one'; name: string } | { kind: 'several' } | { kind: 'none' }
  /** Null without a tenancy in the year. */
  period: { from: IsoDate; to: IsoDate } | null
  /** Basis points at the end of the user's period in the year. */
  share: number
}

export type HousingDetail = 'name' | 'business_id' | 'apartment_number'

/** What needs checking in the year; no check changes a figure. */
export type Check =
  | { kind: 'unpaid'; months: Month[] }
  | { kind: 'partly_paid'; months: { month: Month; missing: number }[] }
  | { kind: 'vacant'; months: Month[] }
  | { kind: 'details_missing'; missing: HousingDetail[] }
  | { kind: 'treatment_not_set'; months: Month[] }
  | { kind: 'share_changed'; on: IsoDate; from: number; to: number }

export interface FlatYear {
  propertyId: string
  /** The user had a share above 0 on some day of the year, up to today. */
  included: boolean
  rows: Record<RowNumber, Row>
  /** Counted in no row, at the user's share (cents). */
  outside: { capitalised: number; improvements: number }
  details: FlatDetails
  checks: Check[]
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
  const months = monthsCounted(year, today)
  const treatmentNotSet: Month[] = []
  const vacant: Month[] = []
  for (const month of months) {
    const first = `${month}-01`
    const charged = chargeMonth(input.charges, input.treatments, month)
    let monthCents = 0
    for (const charge of charged?.charges ?? []) {
      monthCents += charge.cents
      if (charge.kind === 'maintenance_charge') {
        add('2.2', 'maintenance_charge', charge.cents, first)
      } else if (charged?.treatment === undefined) {
        if (charge.cents > 0 && shareAt(first) > 0) {
          treatmentNotSet.push(month)
        }
      } else if (charged.treatment === 'income_recognised') {
        add('2.3', 'financing_charge', charge.cents, first)
      } else {
        outside.capitalised.add(
          'financing_charge',
          charge.cents,
          shareAt(first),
        )
      }
    }
    const used = usageChargesOfMonth(input.usageCharges, occupied, month)
    for (const charge of used?.charges ?? []) {
      monthCents += charge.cents
      add(
        ROW_OF[USAGE_CHARGE_ROWS[charge.kind]],
        charge.kind,
        charge.cents,
        first,
      )
    }
    const ran = input.tenancies.some(
      (tenancy) => tenancyMonths(tenancy, month, month).length > 0,
    )
    if (!ran && monthCents > 0 && shareAt(first) > 0) {
      vacant.push(month)
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
    details: flatDetails(input, userId, year, today),
    checks: [
      ...paymentChecks(input, userId, months, today),
      ...(vacant.length > 0
        ? [{ kind: 'vacant' as const, months: vacant }]
        : []),
      ...detailsChecks(input.housingCompany),
      ...(treatmentNotSet.length > 0
        ? [{ kind: 'treatment_not_set' as const, months: treatmentNotSet }]
        : []),
      ...shareChanges(ownership, userId, year, today),
    ],
  }
}

/** The last day of the year counted: 31 December, or today in the current year. */
const lastDayCounted = (year: number, today: IsoDate): IsoDate =>
  `${String(year)}-12-31` < today ? `${String(year)}-12-31` : today

/** The tenancies that ran on some day of the year counted. */
function tenanciesInYear(
  tenancies: readonly SummaryTenancy[],
  year: number,
  today: IsoDate,
): SummaryTenancy[] {
  const first = `${String(year)}-01-01`
  const last = lastDayCounted(year, today)
  return tenancies.filter(
    (t) => t.validFrom <= last && (t.validTo === null || t.validTo >= first),
  )
}

function flatDetails(
  input: FlatYearInput,
  userId: string,
  year: number,
  today: IsoDate,
): FlatDetails {
  const ran = tenanciesInYear(input.tenancies, year, today)
  const first = `${String(year)}-01-01`
  const end = `${String(year)}-12-31`
  const only = ran.length === 1 ? ran[0] : undefined
  return {
    ...input.housingCompany,
    tenant: only
      ? { kind: 'one', name: only.tenantName }
      : ran.length > 1
        ? { kind: 'several' }
        : { kind: 'none' },
    period: only
      ? {
          from: only.validFrom > first ? only.validFrom : first,
          to: only.validTo !== null && only.validTo < end ? only.validTo : end,
        }
      : ran.length > 1
        ? { from: first, to: end }
        : null,
    share: shareAtEnd(input.ownership, userId, year, today),
  }
}

/** The user's share at the end of their ownership in the year. */
function shareAtEnd(
  ownership: readonly Period[],
  userId: string,
  year: number,
  today: IsoDate,
): number {
  const first = `${String(year)}-01-01`
  const last = lastDayCounted(year, today)
  let share = 0
  let end = ''
  for (const period of ownership) {
    const own = period.shares.find((s) => s.userId === userId)?.share ?? 0
    const periodEnd =
      period.validTo !== null && period.validTo < last ? period.validTo : last
    if (
      own > 0 &&
      period.validFrom <= last &&
      periodEnd >= first &&
      periodEnd > end
    ) {
      end = periodEnd
      share = own
    }
  }
  return share
}

/** Months not fully paid, in months the user had a share on the first day. */
function paymentChecks(
  input: FlatYearInput,
  userId: string,
  months: readonly Month[],
  today: IsoDate,
): Check[] {
  const from = months.at(0)
  const to = months.at(-1)
  if (from === undefined || to === undefined) {
    return []
  }
  const rows = rentMonths({
    tenancies: input.tenancies,
    payments: input.payments,
    rents: Object.fromEntries(input.tenancies.map((t) => [t.id, t.rent])),
    occupants: Object.fromEntries(
      input.tenancies.map((t) => [t.id, t.occupants]),
    ),
    fees: Object.fromEntries(input.tenancies.map((t) => [t.id, t.fees])),
    from,
    to,
    today,
  })
    .filter((row) => shareOn(input.ownership, userId, `${row.month}-01`) > 0)
    .reverse()
  const unpaid = rows
    .filter((row) => row.status.kind === 'late')
    .map((row) => row.month)
  const partly = rows.flatMap((row) =>
    row.status.kind === 'partly_paid'
      ? [{ month: row.month, missing: row.status.missing }]
      : [],
  )
  return [
    ...(unpaid.length > 0 ? [{ kind: 'unpaid' as const, months: unpaid }] : []),
    ...(partly.length > 0
      ? [{ kind: 'partly_paid' as const, months: partly }]
      : []),
  ]
}

function detailsChecks(company: HousingCompany): Check[] {
  const missing: HousingDetail[] = [
    ...(company.name ? [] : ['name' as const]),
    ...(company.businessId ? [] : ['business_id' as const]),
    ...(company.apartmentNumber ? [] : ['apartment_number' as const]),
  ]
  return missing.length > 0 ? [{ kind: 'details_missing', missing }] : []
}

/** The days in the year the user's share went from one above 0 to another. */
function shareChanges(
  ownership: readonly Period[],
  userId: string,
  year: number,
  today: IsoDate,
): Check[] {
  const first = `${String(year)}-01-01`
  const last = lastDayCounted(year, today)
  const sorted = [...ownership].sort((a, b) =>
    a.validFrom.localeCompare(b.validFrom),
  )
  const own = (period: Period) =>
    period.shares.find((s) => s.userId === userId)?.share ?? 0
  return sorted.flatMap((period, i) => {
    if (i === 0 || period.validFrom <= first || period.validFrom > last) {
      return []
    }
    const from = own(sorted[i - 1])
    const to = own(period)
    return from > 0 && from !== to
      ? [{ kind: 'share_changed' as const, on: period.validFrom, from, to }]
      : []
  })
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
