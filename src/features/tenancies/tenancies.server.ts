// Tenancies: the logic behind the server functions in functions.ts, with its
// dependencies passed in so Workers tests can drive it (openspec:
// tenancies). The rules are checked here first for the reason, and each
// write checks the owner role and the overlap again in its statement. The
// tenant's details are never logged.
import type { OwnershipRepository } from '#/features/ownership/ownership.repository.server'
import type { Property } from '#/features/properties/property'
import type { PropertyRepository } from '#/features/properties/property.repository.server'
import type { RecurringAmountRepository } from '#/features/recurring-amounts/recurring-amount.repository.server'
import {
  monthOf,
  periodOn,
  validateAmountDate,
  type Period,
} from '#/features/recurring-amounts/periods'
import type { SharingRepository } from '#/features/sharing/sharing.repository.server'
import { isoDateInFinland, type IsoDate } from '#/lib/dates'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import type { NoticeGiver, PropertyRole } from '#/server/db/schema'
import type { Logger } from '#/server/log/log'
import { validateEnding } from './notice'
import { paymentsOutside, validateTenancyDates } from './rules'
import { rentAsked } from './rent'
import { flatStatus } from './status'
import type {
  Ending,
  Tenancy,
  TenancyFields,
  TenancyRepository,
} from './tenancy.repository.server'

export interface TenancyDeps {
  /** The signed-in user. */
  userId: string
  tenancies: TenancyRepository
  amounts: RecurringAmountRepository
  properties: PropertyRepository
  ownership: OwnershipRepository
  sharing: SharingRepository
  log: Logger
  now: () => Date
}

interface Failure<R extends FieldReason | AlertReason = AlertReason> {
  ok: false
  reason: R
}

const notFound = {
  ok: false,
  reason: 'property_not_found',
} as const satisfies Failure
const ownerOnly = {
  ok: false,
  reason: 'sharing_owner_only',
} as const satisfies Failure
const tenancyNotFound = {
  ok: false,
  reason: 'tenancy_not_found',
} as const satisfies Failure
const changedMeanwhile = {
  ok: false,
  reason: 'amount_changed',
} as const satisfies Failure

const fail = <R extends FieldReason | AlertReason>(reason: R): Failure<R> => ({
  ok: false,
  reason,
})

export interface TenancyView {
  role: PropertyRole
  property: Property
  /** Today in Finland. */
  today: IsoDate
  /** Newest first. */
  tenancies: Tenancy[]
}

async function roleCheck(
  deps: TenancyDeps,
  propertyId: string,
): Promise<typeof notFound | typeof ownerOnly | undefined> {
  const role = await deps.sharing.roleOf(deps.userId, propertyId)
  if (!role) {
    return notFound
  }
  return role === 'owner' ? undefined : ownerOnly
}

/** Why a write that didn't apply was refused: access, or the given reason. */
async function refusal<R extends Failure<FieldReason | AlertReason>>(
  deps: TenancyDeps,
  propertyId: string,
  otherwise: R,
): Promise<R | typeof notFound | typeof ownerOnly> {
  return (await roleCheck(deps, propertyId)) ?? otherwise
}

async function ownershipStart(
  deps: TenancyDeps,
  propertyId: string,
): Promise<IsoDate | undefined> {
  const { periods } = await deps.ownership.history(propertyId)
  return periods.at(-1)?.validFrom
}

const today = (deps: TenancyDeps) => isoDateInFinland(deps.now())

/** The flat's tenancies and its amounts, or undefined without access. */
async function loadView(
  deps: TenancyDeps,
  propertyId: string,
): Promise<
  | (TenancyView & {
      amounts: Awaited<ReturnType<RecurringAmountRepository['forProperty']>>
    })
  | undefined
> {
  const [role, property, tenancies, amounts] = await Promise.all([
    deps.sharing.roleOf(deps.userId, propertyId),
    deps.properties.findForUser(deps.userId, propertyId),
    deps.tenancies.forProperty(propertyId),
    deps.amounts.forProperty(propertyId),
  ])
  if (!role || !property) {
    return undefined
  }
  return { role, property, today: today(deps), tenancies, amounts }
}

/** The flat's tenancies, for everyone with access. */
export async function getTenancies(
  deps: TenancyDeps,
  propertyId: string,
): Promise<
  ({ ok: true; rentToday: number | null } & TenancyView) | typeof notFound
> {
  const view = await loadView(deps, propertyId)
  if (!view) {
    return notFound
  }
  const { amounts, ...rest } = view
  return {
    ok: true,
    ...rest,
    rentToday: periodOn(amounts.amounts.rent, view.today)?.value ?? null,
  }
}

/** What the new tenant form needs: the rent periods and the limits. */
export async function getNewTenancyOptions(
  deps: TenancyDeps,
  propertyId: string,
): Promise<
  | ({
      ok: true
      /** Oldest first. */
      rents: Period<number>[]
      ownershipStart: IsoDate
    } & TenancyView)
  | typeof notFound
> {
  const [view, start] = await Promise.all([
    loadView(deps, propertyId),
    ownershipStart(deps, propertyId),
  ])
  if (!view || start === undefined) {
    return notFound
  }
  const { amounts, ...rest } = view
  return {
    ok: true,
    ...rest,
    rents: amounts.amounts.rent,
    ownershipStart: start,
  }
}

/** A tenancy of the flat, for correcting or ending it. */
export async function getTenancy(
  deps: TenancyDeps,
  propertyId: string,
  tenancyId: string,
): Promise<
  | {
      ok: true
      role: PropertyRole
      property: Property
      today: IsoDate
      tenancy: Tenancy
      /** The flat's other tenancies, for the form's checks. */
      others: Tenancy[]
      ownershipStart: IsoDate
    }
  | typeof notFound
  | typeof tenancyNotFound
> {
  const [role, property, tenancies, start] = await Promise.all([
    deps.sharing.roleOf(deps.userId, propertyId),
    deps.properties.findForUser(deps.userId, propertyId),
    deps.tenancies.forProperty(propertyId),
    ownershipStart(deps, propertyId),
  ])
  if (!role || !property || start === undefined) {
    return notFound
  }
  const tenancy = tenancies.find((t) => t.id === tenancyId)
  if (!tenancy) {
    return tenancyNotFound
  }
  return {
    ok: true,
    role,
    property,
    today: today(deps),
    tenancy,
    others: tenancies.filter((t) => t.id !== tenancyId),
    ownershipStart: start,
  }
}

export async function createTenancy(
  deps: TenancyDeps,
  propertyId: string,
  fields: TenancyFields,
  /** The monthly rent in cents as entered; absent when it isn't asked. */
  rent: number | undefined,
  /** An earlier tenancy's ending, recorded with it. */
  ending?: Ending,
): Promise<
  { ok: true; tenancyId: string } | Failure<FieldReason | AlertReason>
> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const [start, others, amounts] = await Promise.all([
    ownershipStart(deps, propertyId),
    deps.tenancies.forProperty(propertyId),
    deps.amounts.forProperty(propertyId),
  ])
  if (start === undefined) {
    return notFound
  }
  const day = today(deps)
  // The ending first: its reasons say more than the overlap or the end
  // before the start that a wrong ending would also cause.
  const problem =
    (ending ? validateEnding(fields, ending, day) : undefined) ??
    validateTenancyDates(
      { ...fields, validTo: ending?.lastDay ?? fields.termEnd },
      { today: day, ownershipStart: start, others },
    )
  if (problem) {
    return fail(problem)
  }
  const rents = amounts.amounts.rent
  const asked = rentAsked(rents, fields.validFrom)
  if (asked && rent === undefined) {
    return fail('amount_invalid')
  }
  const inEffect = periodOn(rents, fields.validFrom)?.value
  let rentWrite: {
    latestStart: IsoDate | null
    from: IsoDate
    amount: number
  } | null = null
  // Before the latest rent period the rent stays on its own page.
  if (asked && rent !== undefined && rent !== inEffect) {
    const from = `${monthOf(fields.validFrom)}-01`
    const latestStart = rents.at(-1)?.validFrom
    const rentProblem = validateAmountDate(from, {
      ownershipStart: start,
      latestStart,
    })
    if (rentProblem) {
      return fail(rentProblem)
    }
    rentWrite = { latestStart: latestStart ?? null, from, amount: rent }
  }
  const created = await deps.tenancies.createWithRent(
    deps.userId,
    propertyId,
    fields,
    rentWrite,
    deps.now(),
    ending,
  )
  if (created.outcome === 'overlaps') {
    return refusal(deps, propertyId, fail('tenancy_overlaps'))
  }
  if (created.outcome === 'rent_changed') {
    // Another write changed the rent between the read and this save, so the
    // batch took the tenancy out again.
    deps.log.warn('tenancy.rent_conflict', { propertyId })
    return changedMeanwhile
  }
  deps.log.info('tenancy.created', {
    propertyId,
    tenancyId: created.id,
    contractType: fields.contractType,
    ended: ending !== undefined,
  })
  if (rentWrite) {
    deps.log.info('recurring_amount.set', {
      propertyId,
      kind: 'rent',
      from: rentWrite.from,
      corrected: rentWrite.from === rentWrite.latestStart,
    })
  }
  return { ok: true, tenancyId: created.id }
}

export async function updateTenancy(
  deps: TenancyDeps,
  propertyId: string,
  tenancyId: string,
  fields: TenancyFields,
): Promise<{ ok: true } | Failure<FieldReason | AlertReason>> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const [start, tenancies] = await Promise.all([
    ownershipStart(deps, propertyId),
    deps.tenancies.forProperty(propertyId),
  ])
  const existing = tenancies.find((t) => t.id === tenancyId)
  if (!existing || start === undefined) {
    return tenancyNotFound
  }
  // An ending already recorded keeps its last day; otherwise the term's.
  const validTo =
    existing.noticeGivenBy === null ? fields.termEnd : existing.validTo
  const problem = validateTenancyDates(
    { ...fields, validTo },
    {
      today: today(deps),
      ownershipStart: start,
      others: tenancies.filter((t) => t.id !== tenancyId),
    },
  )
  if (problem) {
    return fail(problem)
  }
  // A recorded ending must still fit the corrected contract: its type, start,
  // contract date (the landlord's notice period) and term.
  if (
    existing.noticeGivenBy !== null &&
    existing.noticeDate !== null &&
    validTo !== null &&
    validateEnding(
      fields,
      {
        noticeGivenBy: existing.noticeGivenBy,
        noticeDate: existing.noticeDate,
        lastDay: validTo,
      },
      today(deps),
    )
  ) {
    return fail('tenancy_correction_conflicts_ending')
  }
  const months = await deps.tenancies.paymentMonths(tenancyId)
  if (paymentsOutside(months, fields.validFrom, validTo)) {
    return fail('tenancy_has_payments_outside')
  }
  const updated = await deps.tenancies.update(
    deps.userId,
    propertyId,
    tenancyId,
    fields,
    { validTo, expectedValidTo: existing.validTo },
    deps.now(),
  )
  if (!updated) {
    // A payment recorded meanwhile is the likelier cause than a removal.
    const now = await deps.tenancies.paymentMonths(tenancyId)
    return refusal(
      deps,
      propertyId,
      paymentsOutside(now, fields.validFrom, validTo)
        ? fail('tenancy_has_payments_outside')
        : tenancyNotFound,
    )
  }
  deps.log.info('tenancy.updated', { propertyId, tenancyId })
  return { ok: true }
}

export async function endTenancy(
  deps: TenancyDeps,
  propertyId: string,
  tenancyId: string,
  ending: { noticeGivenBy: NoticeGiver; noticeDate: IsoDate; lastDay: IsoDate },
): Promise<{ ok: true } | Failure<FieldReason | AlertReason>> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const existing = await deps.tenancies.get(tenancyId)
  if (existing?.propertyId !== propertyId) {
    return tenancyNotFound
  }
  if (existing.noticeGivenBy !== null) {
    return fail('tenancy_already_ending')
  }
  const problem = validateEnding(existing, ending, today(deps))
  if (problem) {
    return fail(problem)
  }
  const months = await deps.tenancies.paymentMonths(tenancyId)
  if (paymentsOutside(months, existing.validFrom, ending.lastDay)) {
    return fail('tenancy_has_payments_outside')
  }
  const ended = await deps.tenancies.end(
    deps.userId,
    propertyId,
    tenancyId,
    ending,
    deps.now(),
  )
  if (!ended) {
    const now = await deps.tenancies.paymentMonths(tenancyId)
    return refusal(
      deps,
      propertyId,
      paymentsOutside(now, existing.validFrom, ending.lastDay)
        ? fail('tenancy_has_payments_outside')
        : fail('tenancy_already_ending'),
    )
  }
  deps.log.info('tenancy.ended', {
    propertyId,
    tenancyId,
    noticeGivenBy: ending.noticeGivenBy,
  })
  return { ok: true }
}

/** Removes a tenancy that hasn't started, e.g. when the tenant withdrew. */
export async function removeTenancy(
  deps: TenancyDeps,
  propertyId: string,
  tenancyId: string,
): Promise<{ ok: true } | Failure> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const existing = await deps.tenancies.get(tenancyId)
  if (existing?.propertyId !== propertyId) {
    return tenancyNotFound
  }
  const day = today(deps)
  if (existing.validFrom <= day) {
    return fail('tenancy_already_started')
  }
  if ((await deps.tenancies.paymentMonths(tenancyId)).length > 0) {
    return fail('tenancy_has_payments')
  }
  const removed = await deps.tenancies.removeNotStarted(
    deps.userId,
    propertyId,
    tenancyId,
    day,
  )
  if (!removed) {
    const [now, months] = await Promise.all([
      deps.tenancies.get(tenancyId),
      deps.tenancies.paymentMonths(tenancyId),
    ])
    return refusal(
      deps,
      propertyId,
      now?.propertyId !== propertyId
        ? tenancyNotFound
        : months.length > 0
          ? fail('tenancy_has_payments')
          : fail('tenancy_already_started'),
    )
  }
  deps.log.info('tenancy.removed', { propertyId, tenancyId })
  return { ok: true }
}

export async function cancelTenancyEnding(
  deps: TenancyDeps,
  propertyId: string,
  tenancyId: string,
): Promise<{ ok: true } | Failure<FieldReason | AlertReason>> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const tenancies = await deps.tenancies.forProperty(propertyId)
  const existing = tenancies.find((t) => t.id === tenancyId)
  if (!existing) {
    return tenancyNotFound
  }
  const lastDay = existing.validTo
  if (existing.noticeGivenBy === null || lastDay === null) {
    return fail('tenancy_not_ending')
  }
  if (lastDay < today(deps)) {
    return fail('tenancy_already_ended')
  }
  const restored = { from: existing.validFrom, to: existing.termEnd }
  const later = tenancies.some(
    (t) =>
      t.id !== tenancyId &&
      t.validFrom > lastDay &&
      (restored.to === null || t.validFrom <= restored.to),
  )
  if (later) {
    return fail('tenancy_cancel_later_tenancy')
  }
  const cancelled = await deps.tenancies.cancelEnding(
    deps.userId,
    propertyId,
    existing,
    deps.now(),
  )
  if (!cancelled) {
    return refusal(deps, propertyId, fail('tenancy_cancel_later_tenancy'))
  }
  deps.log.info('tenancy.ending_cancelled', { propertyId, tenancyId })
  return { ok: true }
}

/** A flat's tenancy status for its card on the flats list. */
export type CardTenancyStatus =
  | { kind: 'let'; tenantName: string }
  | { kind: 'notice_given'; tenantName: string; on: IsoDate }
  | { kind: 'vacant'; nextStart: IsoDate | null }

/** The tenancy status of each of the user's flats, in one query. */
export async function listTenancyStatuses(
  deps: TenancyDeps,
): Promise<Record<string, CardTenancyStatus>> {
  const flats = await deps.properties.listForUser(deps.userId)
  const day = today(deps)
  const tenancies = await deps.tenancies.currentFor(
    flats.map((flat) => flat.id),
    day,
  )
  const statuses: Record<string, CardTenancyStatus> = {}
  for (const flat of flats) {
    const status = flatStatus(
      tenancies.filter((t) => t.propertyId === flat.id),
      day,
    )
    statuses[flat.id] =
      status.kind === 'vacant'
        ? { kind: 'vacant', nextStart: status.next?.validFrom ?? null }
        : status.kind === 'let'
          ? { kind: 'let', tenantName: status.tenancy.tenantName }
          : {
              kind: 'notice_given',
              tenantName: status.tenancy.tenantName,
              on: status.on,
            }
  }
  return statuses
}
