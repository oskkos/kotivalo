// Tenancies: the logic behind the server functions in functions.ts, with its
// dependencies passed in so Workers tests can drive it (openspec:
// tenancies). The rules are checked here first for the reason, and each
// write checks the owner role and the overlap again in its statement. The
// tenant's details are never logged.
import type { DepositReturnRepository } from '#/features/deposits/deposit-return.repository.server'
import type {
  DocumentRepository,
  DocumentRow,
} from '#/features/documents/document.repository.server'
import type { OwnershipRepository } from '#/features/ownership/ownership.repository.server'
import type { Property } from '#/features/properties/property'
import type { PropertyRepository } from '#/features/properties/property.repository.server'
import type { Period } from '#/features/recurring-amounts/periods'
import type { SharingRepository } from '#/features/sharing/sharing.repository.server'
import { isoDateInFinland, type IsoDate } from '#/lib/dates'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import type { NoticeGiver, PropertyRole } from '#/server/db/schema'
import type { Logger } from '#/server/log/log'
import { validateEnding } from './notice'
import { paymentsOutside, validateTenancyDates } from './rules'
import {
  fillsBeforeFirst,
  feeChangesAfterEnd,
  firstPeriodMove,
  firstRentMove,
  periodAfterEnd,
  rentAfterEnd,
  validateRentDate,
  validateTenancyPeriodDate,
} from './rent'
import { MAX_AMOUNT } from '#/features/recurring-amounts/schemas'
import { MAX_CHARGE_DESCRIPTION } from '#/lib/charge-fields'
import type { ChargeBasis, ChargeKind } from '#/server/db/schema'
import { offeredFees } from './fees'
import { MAX_OCCUPANTS } from './schemas'
import { currentTenancy, flatStatus } from './status'
import type {
  Ending,
  Tenancy,
  TenancyFields,
  TenancyRepository,
  TenantFee,
} from './tenancy.repository.server'

export interface TenancyDeps {
  /** The signed-in user. */
  userId: string
  tenancies: TenancyRepository
  depositReturns: DepositReturnRepository
  documents: DocumentRepository
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

/**
 * The flat's tenancies with their rents, occupants and tenant fees, or
 * undefined without access.
 */
async function loadView(
  deps: TenancyDeps,
  propertyId: string,
): Promise<
  | (TenancyView & {
      rents: Partial<Record<string, Period<number>[]>>
      occupants: Partial<Record<string, Period<number>[]>>
      fees: Partial<Record<string, TenantFee[]>>
    })
  | undefined
> {
  const [role, property, tenancies] = await Promise.all([
    deps.sharing.roleOf(deps.userId, propertyId),
    deps.properties.findForUser(deps.userId, propertyId),
    deps.tenancies.forProperty(propertyId),
  ])
  if (!role || !property) {
    return undefined
  }
  const ids = tenancies.map((t) => t.id)
  const [rents, occupants, fees] = await Promise.all([
    deps.tenancies.rentsFor(ids),
    deps.tenancies.occupantsFor(ids),
    deps.tenancies.feesFor(ids),
  ])
  return {
    role,
    property,
    today: today(deps),
    tenancies,
    rents,
    occupants,
    fees,
  }
}

/** The flat's tenancies, for everyone with access. */
export async function getTenancies(
  deps: TenancyDeps,
  propertyId: string,
): Promise<
  | ({
      ok: true
      /** Each tenancy's rent periods, oldest first. */
      rents: Partial<Record<string, Period<number>[]>>
      /** Each tenancy's occupants periods, oldest first. */
      occupants: Partial<Record<string, Period<number>[]>>
      /** Each tenancy's tenant fees. */
      fees: Partial<Record<string, TenantFee[]>>
      /** The leases naming the current tenancy, newest first. */
      leases: DocumentRow[]
    } & TenancyView)
  | typeof notFound
> {
  const view = await loadView(deps, propertyId)
  if (!view) {
    return notFound
  }
  const current = currentTenancy(view.tenancies, view.today)
  const leases = current ? await deps.documents.leasesOfTenancy(current.id) : []
  return { ok: true, ...view, leases }
}

/** What the new tenant form needs: the rent periods and the limits. */
export async function getNewTenancyOptions(
  deps: TenancyDeps,
  propertyId: string,
): Promise<
  | ({
      ok: true
      /** Each tenancy's rent periods, oldest first, for the suggestion. */
      tenancyRents: Partial<Record<string, Period<number>[]>>
      /** Each tenancy's tenant fees, for the fees offered to the next. */
      tenancyFees: Partial<Record<string, TenantFee[]>>
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
  return {
    ok: true,
    role: view.role,
    property: view.property,
    today: view.today,
    tenancies: view.tenancies,
    tenancyRents: view.rents,
    tenancyFees: view.fees,
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
      /** The tenancy's rent periods, oldest first. */
      rents: Period<number>[]
      /** The tenancy's occupants periods, oldest first. */
      occupants: Period<number>[]
      /** The tenancy's tenant fees. */
      fees: TenantFee[]
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
  const [rents, occupants, fees] = await Promise.all([
    deps.tenancies.rentsFor([tenancyId]),
    deps.tenancies.occupantsFor([tenancyId]),
    deps.tenancies.feesFor([tenancyId]),
  ])
  return {
    ok: true,
    role,
    property,
    today: today(deps),
    tenancy,
    rents: rents[tenancyId] ?? [],
    occupants: occupants[tenancyId] ?? [],
    fees: fees[tenancyId] ?? [],
    others: tenancies.filter((t) => t.id !== tenancyId),
    ownershipStart: start,
  }
}

export async function createTenancy(
  deps: TenancyDeps,
  propertyId: string,
  fields: TenancyFields,
  /** The monthly rent in cents, the tenancy's first rent from its start. */
  rent: number,
  /** The persons living in the flat, from the tenancy's start. */
  occupants: number,
  /** An earlier tenancy's ending, recorded with it. */
  ending?: Ending,
  /** Fees of the previous tenancy to continue, by id. */
  copyFeeIds: readonly string[] = [],
): Promise<
  { ok: true; tenancyId: string } | Failure<FieldReason | AlertReason>
> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const [start, others] = await Promise.all([
    ownershipStart(deps, propertyId),
    deps.tenancies.forProperty(propertyId),
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
  // Only fees the form offered: the previous tenancy's, not ended.
  let copied: Parameters<TenancyRepository['createWithRent']>[7] = []
  if (copyFeeIds.length > 0) {
    const feesById = await deps.tenancies.feesFor(others.map((t) => t.id))
    const offered = offeredFees(
      others.map((t) => ({ ...t, fees: feesById[t.id] ?? [] })),
      fields.validFrom,
    )
    const wanted = copyFeeIds.map((id) => offered.find((o) => o.fee.id === id))
    if (wanted.some((o) => o === undefined)) {
      return fail('tenant_fee_not_found')
    }
    copied = wanted.flatMap((o) =>
      o
        ? [
            {
              kind: o.fee.kind,
              basis: o.fee.basis,
              description: o.fee.description,
              amount: o.amount,
            },
          ]
        : [],
    )
  }
  const created = await deps.tenancies.createWithRent(
    deps.userId,
    propertyId,
    fields,
    rent,
    deps.now(),
    ending,
    occupants,
    copied,
  )
  if (created.outcome === 'overlaps') {
    return refusal(deps, propertyId, fail('tenancy_overlaps'))
  }
  deps.log.info('tenancy.created', {
    propertyId,
    tenancyId: created.id,
    contractType: fields.contractType,
    ended: ending !== undefined,
  })
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
  // A recorded deposit return keeps the deposit and the last rent day.
  const depositReturn = await deps.depositReturns.forTenancy(tenancyId)
  if (depositReturn) {
    const kept = depositReturn.rentKept + depositReturn.damageKept
    if ((fields.deposit ?? 0) < kept) {
      return fail('deposit_below_kept')
    }
    if (validTo === null || validTo > depositReturn.returnedOn) {
      return fail('tenancy_has_deposit_return')
    }
  }
  const [months, rentsById, occupantsById, feesById] = await Promise.all([
    deps.tenancies.paymentMonths(tenancyId),
    deps.tenancies.rentsFor([tenancyId]),
    deps.tenancies.occupantsFor([tenancyId]),
    deps.tenancies.feesFor([tenancyId]),
  ])
  if (paymentsOutside(months, fields.validFrom, validTo)) {
    return fail('tenancy_has_payments_outside')
  }
  // The rent, the occupants and the fees stay inside the tenancy: their first
  // periods follow the start, and none starts after the last day.
  const rents = rentsById[tenancyId] ?? []
  const move = firstRentMove(rents, existing.validFrom, fields.validFrom)
  if (!move.ok) {
    return fail(move.reason)
  }
  if (rentAfterEnd(rents, validTo)) {
    return fail('tenancy_has_rent_after_end')
  }
  const occupants = occupantsById[tenancyId] ?? []
  const fees = feesById[tenancyId] ?? []
  const occupantsMove = firstPeriodMove(
    occupants,
    existing.validFrom,
    fields.validFrom,
  )
  const feeMoves = fees.map((fee) => ({
    fee,
    move: firstPeriodMove(fee.amounts, existing.validFrom, fields.validFrom),
  }))
  if (!occupantsMove.ok || feeMoves.some(({ move }) => !move.ok)) {
    return fail('tenancy_start_after_change')
  }
  if (
    periodAfterEnd(occupants, validTo) ||
    fees.some((fee) => feeChangesAfterEnd(fee.amounts, validTo))
  ) {
    return fail('tenancy_has_changes_after_end')
  }
  const updated = await deps.tenancies.update(
    deps.userId,
    propertyId,
    tenancyId,
    fields,
    {
      validTo,
      expectedValidTo: existing.validTo,
      firstRent: move.move,
      firstOccupants: occupantsMove.move,
      firstFees: feeMoves.flatMap(({ fee, move }) =>
        move.ok && move.move ? [{ feeId: fee.id, ...move.move }] : [],
      ),
    },
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
  const [months, rentsById, occupantsById, feesById] = await Promise.all([
    deps.tenancies.paymentMonths(tenancyId),
    deps.tenancies.rentsFor([tenancyId]),
    deps.tenancies.occupantsFor([tenancyId]),
    deps.tenancies.feesFor([tenancyId]),
  ])
  if (paymentsOutside(months, existing.validFrom, ending.lastDay)) {
    return fail('tenancy_has_payments_outside')
  }
  if (rentAfterEnd(rentsById[tenancyId] ?? [], ending.lastDay)) {
    return fail('tenancy_has_rent_after_end')
  }
  if (
    periodAfterEnd(occupantsById[tenancyId] ?? [], ending.lastDay) ||
    (feesById[tenancyId] ?? []).some((fee) =>
      feeChangesAfterEnd(fee.amounts, ending.lastDay),
    )
  ) {
    return fail('tenancy_has_changes_after_end')
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
  if (await deps.depositReturns.forTenancy(tenancyId)) {
    return fail('tenancy_has_deposit_return')
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

const changedMeanwhile = fail('amount_changed')

/**
 * Sets a tenancy's rent from a date (openspec: tenancies, "Changing a
 * tenancy's rent"): a new period, or a correction on a period's start.
 */
export async function setTenancyRent(
  deps: TenancyDeps,
  propertyId: string,
  tenancyId: string,
  change: { amount: number; from: IsoDate },
): Promise<{ ok: true } | Failure<FieldReason | AlertReason>> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const tenancy = await deps.tenancies.get(tenancyId)
  if (tenancy?.propertyId !== propertyId) {
    return tenancyNotFound
  }
  const rents = (await deps.tenancies.rentsFor([tenancyId]))[tenancyId] ?? []
  const starts = rents.map((rent) => rent.validFrom)
  const firstStart = starts.at(0)
  const latestStart = starts.at(-1)
  const corrects = starts.includes(change.from)
  const problem = validateRentDate(change.from, { tenancy, starts })
  if (problem) {
    return fail(problem)
  }
  const set = await deps.tenancies.setRent({
    actorId: deps.userId,
    propertyId,
    tenancyId,
    amount: change.amount,
    from: change.from,
    latestStart: latestStart ?? null,
    corrects,
    ...(fillsBeforeFirst(change.from, firstStart) && { firstStart }),
  })
  if (!set) {
    return refusal(deps, propertyId, changedMeanwhile)
  }
  deps.log.info(corrects ? 'tenancy.rent_corrected' : 'tenancy.rent_changed', {
    propertyId,
    tenancyId,
  })
  return { ok: true }
}

/**
 * Undoes a tenancy's latest rent change (openspec: tenancies, "Undoing a
 * tenancy's rent change"). The first rent stays: there is nothing to undo
 * with fewer than two periods.
 */
export async function undoTenancyRent(
  deps: TenancyDeps,
  propertyId: string,
  tenancyId: string,
): Promise<{ ok: true } | Failure> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const tenancy = await deps.tenancies.get(tenancyId)
  if (tenancy?.propertyId !== propertyId) {
    return tenancyNotFound
  }
  const rents = (await deps.tenancies.rentsFor([tenancyId]))[tenancyId] ?? []
  const latest = rents.at(-1)
  const previous = rents.at(-2)
  if (!latest || !previous) {
    return fail('amount_nothing_to_undo')
  }
  const undone = await deps.tenancies.undoLatestRent({
    actorId: deps.userId,
    propertyId,
    tenancyId,
    latestStart: latest.validFrom,
    previousStart: previous.validFrom,
  })
  if (!undone) {
    return refusal(deps, propertyId, changedMeanwhile)
  }
  deps.log.info('tenancy.rent_change_undone', { propertyId, tenancyId })
  return { ok: true }
}

/**
 * Sets a tenancy's occupants from a date (openspec: tenancies, "Changing the
 * occupants"): a new period, or a correction on the latest period's start.
 */
export async function setTenancyOccupants(
  deps: TenancyDeps,
  propertyId: string,
  tenancyId: string,
  change: { persons: number; from: IsoDate },
): Promise<{ ok: true } | Failure<FieldReason | AlertReason>> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const tenancy = await deps.tenancies.get(tenancyId)
  if (tenancy?.propertyId !== propertyId) {
    return tenancyNotFound
  }
  if (
    !Number.isInteger(change.persons) ||
    change.persons < 1 ||
    change.persons > MAX_OCCUPANTS
  ) {
    return fail('occupants_invalid')
  }
  const periods =
    (await deps.tenancies.occupantsFor([tenancyId]))[tenancyId] ?? []
  const latestStart = periods.at(-1)?.validFrom
  const problem = validateTenancyPeriodDate(change.from, {
    tenancy,
    latestStart,
  })
  if (problem) {
    return fail(problem)
  }
  const corrects = latestStart === change.from
  const set = await deps.tenancies.setOccupants({
    actorId: deps.userId,
    propertyId,
    tenancyId,
    persons: change.persons,
    from: change.from,
    latestStart: latestStart ?? null,
    corrects,
  })
  if (!set) {
    return refusal(deps, propertyId, changedMeanwhile)
  }
  deps.log.info(
    corrects ? 'tenancy.occupants_corrected' : 'tenancy.occupants_changed',
    { propertyId, tenancyId },
  )
  return { ok: true }
}

/**
 * Undoes a tenancy's latest occupants change (openspec: tenancies, "Changing
 * the occupants"). The first period stays: there is nothing to undo with
 * fewer than two.
 */
export async function undoTenancyOccupants(
  deps: TenancyDeps,
  propertyId: string,
  tenancyId: string,
): Promise<{ ok: true } | Failure> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const tenancy = await deps.tenancies.get(tenancyId)
  if (tenancy?.propertyId !== propertyId) {
    return tenancyNotFound
  }
  const periods =
    (await deps.tenancies.occupantsFor([tenancyId]))[tenancyId] ?? []
  const latest = periods.at(-1)
  const previous = periods.at(-2)
  if (!latest || !previous) {
    return fail('occupants_nothing_to_undo')
  }
  const undone = await deps.tenancies.undoOccupants({
    actorId: deps.userId,
    propertyId,
    tenancyId,
    latestStart: latest.validFrom,
    previousStart: previous.validFrom,
  })
  if (!undone) {
    return refusal(deps, propertyId, changedMeanwhile)
  }
  deps.log.info('tenancy.occupants_change_undone', { propertyId, tenancyId })
  return { ok: true }
}

/** A tenant fee's kind, basis and description, as the form sends them. */
export interface FeeFields {
  kind: ChargeKind
  basis: ChargeBasis
  /** Set for the kind `other`. */
  description: string | null
}

/**
 * Adds a tenant fee to a tenancy with its first amount from a date (openspec:
 * tenancies, "Adding a tenant fee").
 */
export async function addTenantFee(
  deps: TenancyDeps,
  propertyId: string,
  tenancyId: string,
  fee: FeeFields & { amount: number; from: IsoDate },
): Promise<{ ok: true; feeId: string } | Failure<FieldReason | AlertReason>> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const tenancy = await deps.tenancies.get(tenancyId)
  if (tenancy?.propertyId !== propertyId) {
    return tenancyNotFound
  }
  if (
    !Number.isInteger(fee.amount) ||
    fee.amount < 0 ||
    fee.amount > MAX_AMOUNT
  ) {
    return fail('amount_invalid')
  }
  const description =
    fee.kind === 'other' ? (fee.description?.trim() ?? '') : null
  if (
    fee.kind === 'other' &&
    (description === null ||
      description.length === 0 ||
      description.length > MAX_CHARGE_DESCRIPTION)
  ) {
    return fail('description_required')
  }
  const problem = validateTenancyPeriodDate(fee.from, {
    tenancy,
    latestStart: undefined,
  })
  if (problem) {
    return fail(problem)
  }
  const feeId = await deps.tenancies.addFee({
    actorId: deps.userId,
    propertyId,
    tenancyId,
    kind: fee.kind,
    basis: fee.basis,
    description,
    amount: fee.amount,
    from: fee.from,
  })
  if (feeId === null) {
    return refusal(deps, propertyId, tenancyNotFound)
  }
  deps.log.info('tenancy.fee_added', { propertyId, tenancyId, feeId })
  return { ok: true, feeId }
}

/**
 * The tenancy's fee, with the tenancy it must belong to, or a reason: a
 * tenancy that isn't the flat's is `tenant_fee_not_found` too.
 */
async function loadFee(
  deps: TenancyDeps,
  propertyId: string,
  tenancyId: string,
  feeId: string,
) {
  const tenancy = await deps.tenancies.get(tenancyId)
  if (tenancy?.propertyId !== propertyId) {
    return { ok: false, failure: fail('tenant_fee_not_found') } as const
  }
  const fees = (await deps.tenancies.feesFor([tenancyId]))[tenancyId] ?? []
  const fee = fees.find((f) => f.id === feeId)
  if (!fee) {
    return { ok: false, failure: fail('tenant_fee_not_found') } as const
  }
  return { ok: true, tenancy, fee } as const
}

/**
 * Gives a tenant fee a new amount from a date (openspec: tenancies, "Changing
 * a tenant fee"): a new period, or a correction on the latest period's start.
 * An amount of 0 ends the fee.
 */
export async function setTenantFee(
  deps: TenancyDeps,
  propertyId: string,
  tenancyId: string,
  feeId: string,
  change: { amount: number; from: IsoDate },
): Promise<{ ok: true } | Failure<FieldReason | AlertReason>> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const loaded = await loadFee(deps, propertyId, tenancyId, feeId)
  if (!loaded.ok) {
    return loaded.failure
  }
  const { tenancy, fee } = loaded
  if (
    !Number.isInteger(change.amount) ||
    change.amount < 0 ||
    change.amount > MAX_AMOUNT
  ) {
    return fail('amount_invalid')
  }
  const latestStart = fee.amounts.at(-1)?.validFrom
  const problem = validateTenancyPeriodDate(change.from, {
    tenancy,
    latestStart,
  })
  if (problem) {
    return fail(problem)
  }
  if (latestStart === undefined) {
    return fail('tenant_fee_not_found')
  }
  const corrects = latestStart === change.from
  const set = await deps.tenancies.setFeeAmount({
    actorId: deps.userId,
    propertyId,
    tenancyId,
    feeId,
    amount: change.amount,
    from: change.from,
    latestStart,
    corrects,
  })
  if (!set) {
    return refusal(deps, propertyId, changedMeanwhile)
  }
  deps.log.info(
    corrects ? 'tenancy.fee_amount_corrected' : 'tenancy.fee_amount_set',
    { propertyId, tenancyId, feeId },
  )
  return { ok: true }
}

/**
 * Undoes a tenant fee's latest change (openspec: tenancies, "Undoing a tenant
 * fee change"); the fee's only amount undone removes the fee.
 */
export async function undoTenantFee(
  deps: TenancyDeps,
  propertyId: string,
  tenancyId: string,
  feeId: string,
): Promise<{ ok: true } | Failure> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const loaded = await loadFee(deps, propertyId, tenancyId, feeId)
  if (!loaded.ok) {
    return loaded.failure
  }
  const latest = loaded.fee.amounts.at(-1)
  if (!latest) {
    return fail('amount_nothing_to_undo')
  }
  const previous = loaded.fee.amounts.at(-2)
  const undone = await deps.tenancies.undoFeeChange({
    actorId: deps.userId,
    propertyId,
    tenancyId,
    feeId,
    latestStart: latest.validFrom,
    previousStart: previous?.validFrom ?? null,
  })
  if (!undone) {
    return refusal(deps, propertyId, changedMeanwhile)
  }
  deps.log.info(
    previous ? 'tenancy.fee_change_undone' : 'tenancy.fee_removed',
    {
      propertyId,
      tenancyId,
      feeId,
    },
  )
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
