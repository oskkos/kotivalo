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
  ownedInYear,
  ownersInYear,
  shareAtEnd,
  summaryYears,
  type FlatYear,
  type FlatYearInput,
  type Holder,
} from './summary'
import type {
  CardOwner,
  FlatCard,
  FlatOwner,
  FlatYearView,
  HolderView,
  PdfFlat,
  YearSummaryPdfView,
  YearSummaryView,
} from './view'

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
): Promise<{
  year: number
  inputs: FlatYearInput[]
  names: Record<string, string>
}> {
  const ids = flats.map((flat) => flat.id)
  const [ownership, names, tenancies, payments, amounts, usage] =
    await Promise.all([
      deps.ownership.rowsFor(ids),
      deps.ownership.namesFor(ids),
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
    names,
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

/** The periods of every flat in one list. */
const periodsOf = (ownership: Partial<Record<string, Period[]>>): Period[] =>
  Object.values(ownership).flat() as Period[]

/**
 * Whose figures to compute: the own share unless `person` is `whole` or
 * another user with a share above 0 in these flats in some year. Any other
 * id gives the own share, so a guessed id shows nothing.
 */
function holderOf(
  deps: YearSummaryDeps,
  periods: readonly Period[],
  person: string | undefined,
): Holder {
  if (person === 'whole') {
    return { kind: 'whole' }
  }
  const known =
    person !== undefined &&
    person !== deps.userId &&
    periods.some((p) =>
      p.shares.some((s) => s.userId === person && s.share > 0),
    )
  return { kind: 'owner', userId: known ? person : deps.userId }
}

/**
 * The years of the holder's shares across the flats, oldest first. An own
 * share without any (a member with no share) uses the whole flats' years.
 */
function yearsOf(
  periods: readonly Period[],
  holder: Holder,
  day: IsoDate,
): number[] {
  const years = summaryYears(periods, holder, day)
  return years.length > 0
    ? years
    : summaryYears(periods, { kind: 'whole' }, day)
}

/** The holder as the view names them. */
function holderView(
  deps: YearSummaryDeps,
  holder: Holder,
  names: Record<string, string>,
): HolderView {
  if (holder.kind === 'whole') {
    return { kind: 'whole' }
  }
  return holder.userId === deps.userId
    ? { kind: 'own' }
    : {
        kind: 'person',
        userId: holder.userId,
        name: names[holder.userId] ?? '',
      }
}

const isYou = (deps: YearSummaryDeps, userId: string) => userId === deps.userId

/** The owners of a flat in the year as a card shows them, you first. */
function cardOwners(
  deps: YearSummaryDeps,
  input: FlatYearInput,
  names: Record<string, string>,
  year: number,
  day: IsoDate,
): CardOwner[] {
  return ownersInYear(input.ownership, year, day)
    .map((userId) => ({
      userId,
      name: names[userId] ?? '',
      share: shareAtEnd(input.ownership, { kind: 'owner', userId }, year, day),
      isYou: isYou(deps, userId),
    }))
    .sort(
      (a, b) =>
        Number(b.isYou) - Number(a.isYou) || a.name.localeCompare(b.name),
    )
    .map(({ name, share, isYou: you }) => ({ name, share, isYou: you }))
}

/**
 * The year summary: a card per flat the holder had a share in during the
 * year, archived flats included, and the other flats named. The holder is the
 * user's own share, another owner of the user's flats (`person`: their id)
 * or the whole flats (`person`: `whole`). Without `year` it opens on the
 * opening year; a year outside the range opens the nearest.
 */
export async function loadYearSummary(
  deps: YearSummaryDeps,
  year?: number,
  person?: string,
): Promise<YearSummaryView> {
  return (await summarise(deps, year, person)).view
}

/** The year summary with the flat years it was computed from. */
async function summarise(
  deps: YearSummaryDeps,
  year: number | undefined,
  person: string | undefined,
) {
  const day = today(deps)
  const flats = await userFlats(deps)
  let years: number[] = []
  let holder = { kind: 'owner', userId: deps.userId } as Holder
  const loaded = await loadInputs(deps, flats, (ownership) => {
    const periods = periodsOf(ownership)
    holder = holderOf(deps, periods, person)
    years = yearsOf(periods, holder, day)
    return year === undefined ? openingYear(years, day) : clampYear(years, year)
  })
  const cards: FlatCard[] = []
  const results = new Map<string, FlatYear>()
  const notIncluded: YearSummaryView['notIncluded'] = []
  for (const [i, input] of loaded.inputs.entries()) {
    const flat = flats[i]
    const result = flatYear(input, holder, loaded.year, day)
    if (!result.included) {
      if (holder.kind === 'owner') {
        notIncluded.push({
          propertyId: flat.id,
          streetAddress: flat.streetAddress,
        })
      }
      continue
    }
    results.set(flat.id, result)
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
      owners:
        holder.kind === 'whole'
          ? cardOwners(deps, input, loaded.names, loaded.year, day)
          : [],
    })
  }

  const me = { kind: 'owner', userId: deps.userId } as const
  const count = (of: Holder) =>
    loaded.inputs.filter((i) => ownedInYear(i.ownership, of, loaded.year, day))
      .length
  // A chosen person without a share in the year is listed with 0 flats, so
  // the selector stays and the choice stays marked.
  const chosen =
    holder.kind === 'owner' && holder.userId !== deps.userId
      ? [holder.userId]
      : []
  const people = [
    ...new Set([
      ...loaded.inputs.flatMap((i) =>
        ownersInYear(i.ownership, loaded.year, day),
      ),
      ...chosen,
    ]),
  ]
    .filter((userId) => userId !== deps.userId)
    .map((userId) => ({
      userId,
      name: loaded.names[userId] ?? '',
      flats: count({ kind: 'owner', userId }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const view: YearSummaryView = {
    today: day,
    year: loaded.year,
    years,
    holder: holderView(deps, holder, loaded.names),
    people,
    counts: { own: count(me), whole: count({ kind: 'whole' }) },
    flats: cards,
    notIncluded,
  }
  return { view, holder, flats, loaded, results, day }
}

/** The owners of a whole flat with their row 2.1, you first. */
function flatOwners(
  deps: YearSummaryDeps,
  input: FlatYearInput,
  names: Record<string, string>,
  year: number,
  day: IsoDate,
): FlatOwner[] {
  return ownersInYear(input.ownership, year, day)
    .map((userId) => {
      const own = flatYear(input, { kind: 'owner', userId }, year, day)
      return {
        userId,
        name: names[userId] ?? '',
        share: own.details.share,
        income: own.rows['2.1'].cents,
        isYou: isYou(deps, userId),
      }
    })
    .sort(
      (a, b) =>
        Number(b.isYou) - Number(a.isYou) || a.name.localeCompare(b.name),
    )
}

/**
 * Everything the year summary PDF shows, for the same holder and year as the
 * page: the cards and each flat's full year, computed once.
 * Both lists are unsorted, one flat per card in the same order: the document
 * sorts them by address in the user's language. The PDF is built in the browser.
 */
export async function loadYearSummaryPdf(
  deps: YearSummaryDeps,
  year?: number,
  person?: string,
): Promise<YearSummaryPdfView> {
  const { view, holder, flats, loaded, results, day } = await summarise(
    deps,
    year,
    person,
  )
  const byId = new Map(flats.map((flat, i) => [flat.id, i]))
  const pdfFlats = view.flats.map((card): PdfFlat => {
    const flat = flats[byId.get(card.propertyId) ?? 0]
    const input = loaded.inputs[byId.get(card.propertyId) ?? 0]
    const result = results.get(card.propertyId)
    if (!result) {
      throw new Error('A card without its flat year')
    }
    return {
      propertyId: flat.id,
      streetAddress: flat.streetAddress,
      postcode: flat.postcode,
      city: flat.city,
      owners:
        holder.kind === 'whole'
          ? flatOwners(deps, input, loaded.names, loaded.year, day)
          : [],
      rows: result.rows,
      outside: result.outside,
      details: result.details,
      checks: result.checks,
    }
  })
  return {
    holder: view.holder,
    holderName:
      holder.kind === 'whole' ? '' : (loaded.names[holder.userId] ?? ''),
    today: view.today,
    year: view.year,
    cards: view.flats,
    notIncluded: view.notIncluded,
    flats: pdfFlats,
  }
}

/**
 * A flat's form 7H page for the year: not found unless the user can see the
 * flat (archived included), and no figures in a year without the holder's
 * share. The holder is chosen as in the summary, among the owners of all
 * the user's flats. Without `year` it opens on the opening year of the
 * holder's years in this flat.
 */
export async function loadFlatYear(
  deps: YearSummaryDeps,
  propertyId: string,
  year?: number,
  person?: string,
): Promise<FlatYearView> {
  const day = today(deps)
  const flats = await userFlats(deps)
  const flat = flats.find((f) => f.id === propertyId)
  if (!flat) {
    return { ok: false, reason: 'property_not_found' }
  }
  // Another owner is known from all the user's flats, as in the summary, so
  // an owner of another flat gets this flat's no-share state with their name.
  let holder = holderOf(deps, [], person)
  let names: Record<string, string> = {}
  if (holder.kind === 'owner' && person !== undefined) {
    const ids = flats.map((f) => f.id)
    const [ownership, allNames] = await Promise.all([
      deps.ownership.rowsFor(ids),
      deps.ownership.namesFor(ids),
    ])
    holder = holderOf(deps, periodsOf(ownership), person)
    names = allNames
  }
  const loaded = await loadInputs(deps, [flat], (ownership) => {
    const periods = periodsOf(ownership)
    return year ?? openingYear(yearsOf(periods, holder, day), day)
  })
  const [input] = loaded.inputs
  const { included, rows, outside, details, checks } = flatYear(
    input,
    holder,
    loaded.year,
    day,
  )
  const owners =
    holder.kind === 'whole' && included
      ? flatOwners(deps, input, loaded.names, loaded.year, day)
      : []
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
    holder: holderView(deps, holder, { ...names, ...loaded.names }),
    owners,
    flat: included ? { rows, outside, details, checks } : null,
  }
}
