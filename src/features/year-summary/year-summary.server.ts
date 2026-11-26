// The year summary: the logic behind the server functions in functions.ts,
// with its dependencies passed in so Workers tests can drive it (openspec:
// year-summary). The user's flats, archived included, are the access check;
// every other read is by their ids, so the number of queries doesn't grow
// with the flats (design decision 2). Each function returns the computed
// view only: other owners' ids, payment rows and tenancies outside the year
// never reach the browser. It only reads, so it logs nothing.
import type { DepositReturnRepository } from '#/features/deposits/deposit-return.repository.server'
import type { OwnershipRepository } from '#/features/ownership/ownership.repository.server'
import type { Period } from '#/features/ownership/periods'
import type { Property } from '#/features/properties/property'
import type { PropertyRepository } from '#/features/properties/property.repository.server'
import type { RecurringAmountRepository } from '#/features/recurring-amounts/recurring-amount.repository.server'
import type { RentPaymentRepository } from '#/features/rent-payments/rent-payment.repository.server'
import type { TenancyRepository } from '#/features/tenancies/tenancy.repository.server'
import type { TransactionRepository } from '#/features/transactions/transaction.repository.server'
import type { UsageChargeRepository } from '#/features/usage-charges/usage-charge.repository.server'
import { isoDateInFinland, type IsoDate } from '#/lib/dates'
import {
  clampYear,
  flatYear,
  openingYear,
  summaryYears,
  type FlatYearInput,
} from './summary'
import type { FlatCard, FlatYearView, YearSummaryView } from './view'

export interface YearSummaryDeps {
  /** The signed-in user. */
  userId: string
  properties: PropertyRepository
  ownership: OwnershipRepository
  tenancies: TenancyRepository
  payments: RentPaymentRepository
  depositReturns: DepositReturnRepository
  transactions: TransactionRepository
  amounts: RecurringAmountRepository
  usageCharges: UsageChargeRepository
  now: () => Date
}

const today = (deps: YearSummaryDeps) => isoDateInFinland(deps.now())

/** The user's flats, archived included: the access check. */
async function userFlats(deps: YearSummaryDeps): Promise<Property[]> {
  const [active, archived] = await Promise.all([
    deps.properties.listForUser(deps.userId),
    deps.properties.listArchivedForUser(deps.userId),
  ])
  return [...active, ...archived]
}

/** Every flat's data for the year, with a fixed number of queries. */
async function loadInputs(
  deps: YearSummaryDeps,
  flats: readonly Property[],
  year: (ownership: Partial<Record<string, Period[]>>) => number,
): Promise<{ year: number; inputs: FlatYearInput[] }> {
  const ids = flats.map((flat) => flat.id)
  const [ownership, tenancies, payments, amounts, usage] = await Promise.all([
    deps.ownership.rowsFor(ids),
    deps.tenancies.forProperties(ids),
    deps.payments.forProperties(ids),
    deps.amounts.forProperties(ids),
    deps.usageCharges.forProperties(ids),
  ])
  const chosen = year(ownership)
  const tenancyIds = tenancies.map((t) => t.id)
  const [entries, returns, rents, occupants, fees] = await Promise.all([
    deps.transactions.forPropertiesYear(ids, chosen),
    deps.depositReturns.forPropertiesYear(ids, chosen),
    deps.tenancies.rentsFor(tenancyIds),
    deps.tenancies.occupantsFor(tenancyIds),
    deps.tenancies.feesFor(tenancyIds),
  ])
  return {
    year: chosen,
    inputs: flats.map((flat) => {
      const flatAmounts = amounts[flat.id]
      return {
        propertyId: flat.id,
        housingCompany: {
          name: flat.housingCompanyName ?? null,
          businessId: flat.businessId ?? null,
          apartmentNumber: flat.apartmentNumber ?? null,
        },
        ownership: ownership[flat.id] ?? [],
        tenancies: tenancies
          .filter((t) => t.propertyId === flat.id)
          .map((t) => ({
            id: t.id,
            tenantName: t.tenantName,
            validFrom: t.validFrom,
            validTo: t.validTo,
            dueDay: t.dueDay,
            occupants: occupants[t.id] ?? [],
            rent: rents[t.id] ?? [],
            fees: fees[t.id] ?? [],
          })),
        payments: payments.filter((p) => p.propertyId === flat.id),
        entries: entries.filter((e) => e.propertyId === flat.id),
        depositReturns: returns.filter((r) => r.propertyId === flat.id),
        charges: {
          maintenance: flatAmounts.amounts.maintenance_charge,
          financing: flatAmounts.financingCharges,
        },
        treatments: flatAmounts.treatments,
        usageCharges: usage[flat.id],
      }
    }),
  }
}

/** The years of the user's shares across the flats, oldest first. */
const yearsOf = (
  ownership: Partial<Record<string, Period[]>>,
  userId: string,
  day: IsoDate,
): number[] =>
  summaryYears(
    Object.values(ownership).flat() as Period[],
    { kind: 'owner', userId },
    day,
  )

/**
 * The year summary: a card per flat the user had a share in during the year,
 * archived flats included, and the other flats named. Without `year` it
 * opens on the opening year; a year outside the range opens the nearest.
 */
export async function loadYearSummary(
  deps: YearSummaryDeps,
  year?: number,
): Promise<YearSummaryView> {
  const day = today(deps)
  const flats = await userFlats(deps)
  let years: number[] = []
  const loaded = await loadInputs(deps, flats, (ownership) => {
    years = yearsOf(ownership, deps.userId, day)
    return year === undefined ? openingYear(years, day) : clampYear(years, year)
  })
  const cards: FlatCard[] = []
  const notIncluded: YearSummaryView['notIncluded'] = []
  for (const [i, input] of loaded.inputs.entries()) {
    const flat = flats[i]
    const result = flatYear(
      input,
      { kind: 'owner', userId: deps.userId },
      loaded.year,
      day,
    )
    if (!result.included) {
      notIncluded.push({
        propertyId: flat.id,
        streetAddress: flat.streetAddress,
      })
      continue
    }
    const { '2.1': income, ...costRows } = result.rows
    cards.push({
      propertyId: flat.id,
      streetAddress: flat.streetAddress,
      housingCompanyName: result.details.name,
      businessId: result.details.businessId,
      share: result.details.share,
      income: income.cents,
      costs: Object.values(costRows).reduce((sum, row) => sum + row.cents, 0),
      checks: result.checks,
    })
  }
  return { today: day, year: loaded.year, years, flats: cards, notIncluded }
}

/**
 * A flat's form 7H page for the year: not found unless the user can see the
 * flat (archived included), and no figures in a year without their share.
 * Without `year` it opens on the opening year of the flat's years.
 */
export async function loadFlatYear(
  deps: YearSummaryDeps,
  propertyId: string,
  year?: number,
): Promise<FlatYearView> {
  const day = today(deps)
  const flat = (await userFlats(deps)).find((f) => f.id === propertyId)
  if (!flat) {
    return { ok: false, reason: 'property_not_found' }
  }
  const loaded = await loadInputs(
    deps,
    [flat],
    (ownership) =>
      year ?? openingYear(yearsOf(ownership, deps.userId, day), day),
  )
  const [input] = loaded.inputs
  const { included, rows, outside, details, checks } = flatYear(
    input,
    { kind: 'owner', userId: deps.userId },
    loaded.year,
    day,
  )
  return {
    ok: true,
    today: day,
    year: loaded.year,
    property: {
      id: flat.id,
      streetAddress: flat.streetAddress,
      postcode: flat.postcode,
      city: flat.city,
    },
    flat: included ? { rows, outside, details, checks } : null,
  }
}
