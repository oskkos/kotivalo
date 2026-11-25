// A flat's usage charges: the logic behind the server functions in
// functions.ts, with its dependencies passed in so Workers tests can drive it
// (openspec: usage-charges).
import type { OwnershipRepository } from '#/features/ownership/ownership.repository.server'
import type { Property } from '#/features/properties/property'
import type { PropertyRepository } from '#/features/properties/property.repository.server'
import { validateAmountDate } from '#/features/recurring-amounts/periods'
import { MAX_AMOUNT } from '#/features/recurring-amounts/schemas'
import type { SharingRepository } from '#/features/sharing/sharing.repository.server'
import type { TenancyRepository } from '#/features/tenancies/tenancy.repository.server'
import { MAX_CHARGE_DESCRIPTION } from '#/lib/charge-fields'
import { isoDateInFinland, type IsoDate } from '#/lib/dates'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import type { ChargeBasis, ChargeKind, PropertyRole } from '#/server/db/schema'
import type { Logger } from '#/server/log/log'
import type { OccupiedTenancy, UsageChargePeriods } from './months'
import type { UsageChargeRepository } from './usage-charge.repository.server'

export interface UsageChargeDeps {
  /** The signed-in user. */
  userId: string
  charges: UsageChargeRepository
  tenancies: TenancyRepository
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

const notFound = { ok: false, reason: 'property_not_found' } as const
const ownerOnly = { ok: false, reason: 'sharing_owner_only' } as const
const chargeNotFound = { ok: false, reason: 'usage_charge_not_found' } as const
const changedMeanwhile = { ok: false, reason: 'amount_changed' } as const
const fail = <R extends FieldReason | AlertReason>(reason: R): Failure<R> => ({
  ok: false,
  reason,
})

/** What the usage charge pages compute from. */
export interface UsageChargesView {
  role: PropertyRole
  property: Property
  /** Today in Finland. */
  today: IsoDate
  /** The start of the flat's first ownership period. */
  ownershipStart: IsoDate
  charges: UsageChargePeriods[]
  /** The flat's tenancies with their occupants, for per-occupant amounts. */
  tenancies: OccupiedTenancy[]
}

async function roleCheck(deps: UsageChargeDeps, propertyId: string) {
  const role = await deps.sharing.roleOf(deps.userId, propertyId)
  if (!role) {
    return notFound
  }
  return role === 'owner' ? undefined : ownerOnly
}

async function ownershipStart(deps: UsageChargeDeps, propertyId: string) {
  const { periods } = await deps.ownership.history(propertyId)
  return periods.at(-1)?.validFrom
}

/** The flat's tenancies with their occupants. */
export async function occupiedTenancies(
  tenancies: TenancyRepository,
  propertyId: string,
): Promise<OccupiedTenancy[]> {
  const list = await tenancies.forProperty(propertyId)
  const occupants = await tenancies.occupantsFor(list.map((t) => t.id))
  return list.map((t) => ({
    validFrom: t.validFrom,
    validTo: t.validTo,
    occupants: occupants[t.id] ?? [],
  }))
}

/** The flat's usage charges and occupants, for everyone with access. */
export async function getUsageCharges(
  deps: UsageChargeDeps,
  propertyId: string,
): Promise<({ ok: true } & UsageChargesView) | typeof notFound> {
  const [role, property, start] = await Promise.all([
    deps.sharing.roleOf(deps.userId, propertyId),
    deps.properties.findForUser(deps.userId, propertyId),
    ownershipStart(deps, propertyId),
  ])
  if (!role || !property || start === undefined) {
    return notFound
  }
  const [charges, tenancies] = await Promise.all([
    deps.charges.forProperty(propertyId),
    occupiedTenancies(deps.tenancies, propertyId),
  ])
  return {
    ok: true,
    role,
    property,
    today: isoDateInFinland(deps.now()),
    ownershipStart: start,
    charges,
    tenancies,
  }
}

const validAmount = (amount: number) =>
  Number.isInteger(amount) && amount >= 0 && amount <= MAX_AMOUNT

/** Adds a usage charge with its first amount (openspec: "Adding a usage charge"). */
export async function addUsageCharge(
  deps: UsageChargeDeps,
  propertyId: string,
  charge: {
    kind: ChargeKind
    basis: ChargeBasis
    description: string | null
    amount: number
    from: IsoDate
  },
): Promise<
  { ok: true; chargeId: string } | Failure<FieldReason | AlertReason>
> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  if (!validAmount(charge.amount)) {
    return fail('amount_invalid')
  }
  const description =
    charge.kind === 'other' ? (charge.description?.trim() ?? '') : null
  if (
    description !== null &&
    (description.length === 0 || description.length > MAX_CHARGE_DESCRIPTION)
  ) {
    return fail('description_required')
  }
  const start = await ownershipStart(deps, propertyId)
  if (start === undefined) {
    return notFound
  }
  const problem = validateAmountDate(charge.from, {
    ownershipStart: start,
    latestStart: undefined,
  })
  if (problem) {
    return fail(problem)
  }
  const chargeId = await deps.charges.add({
    actorId: deps.userId,
    propertyId,
    kind: charge.kind,
    basis: charge.basis,
    description,
    amount: charge.amount,
    from: charge.from,
  })
  if (chargeId === null) {
    return (await roleCheck(deps, propertyId)) ?? notFound
  }
  deps.log.info('usage_charge.added', { propertyId, usageChargeId: chargeId })
  return { ok: true, chargeId }
}

async function loadCharge(
  deps: UsageChargeDeps,
  propertyId: string,
  chargeId: string,
) {
  const charges = await deps.charges.forProperty(propertyId)
  return charges.find((c) => c.id === chargeId)
}

/** A new amount from a date (openspec: "Changing a usage charge"). */
export async function setUsageCharge(
  deps: UsageChargeDeps,
  propertyId: string,
  chargeId: string,
  change: { amount: number; from: IsoDate },
): Promise<{ ok: true } | Failure<FieldReason | AlertReason>> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const [charge, start] = await Promise.all([
    loadCharge(deps, propertyId, chargeId),
    ownershipStart(deps, propertyId),
  ])
  const latestStart = charge?.periods.at(-1)?.validFrom
  if (!charge || latestStart === undefined || start === undefined) {
    return chargeNotFound
  }
  if (!validAmount(change.amount)) {
    return fail('amount_invalid')
  }
  const problem = validateAmountDate(change.from, {
    ownershipStart: start,
    latestStart,
  })
  if (problem) {
    return fail(problem)
  }
  const corrects = change.from === latestStart
  const set = await deps.charges.setAmount({
    actorId: deps.userId,
    propertyId,
    chargeId,
    amount: change.amount,
    from: change.from,
    latestStart,
    corrects,
  })
  if (!set) {
    return (await roleCheck(deps, propertyId)) ?? changedMeanwhile
  }
  deps.log.info(
    corrects ? 'usage_charge.amount_corrected' : 'usage_charge.amount_set',
    { propertyId, usageChargeId: chargeId },
  )
  return { ok: true }
}

/**
 * Undoes the latest change (openspec: "Undoing the latest usage charge
 * change"); the only amount undone removes the charge.
 */
export async function undoUsageCharge(
  deps: UsageChargeDeps,
  propertyId: string,
  chargeId: string,
): Promise<{ ok: true } | Failure> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const charge = await loadCharge(deps, propertyId, chargeId)
  if (!charge) {
    return chargeNotFound
  }
  const latest = charge.periods.at(-1)
  if (!latest) {
    return fail('amount_nothing_to_undo')
  }
  const previous = charge.periods.at(-2)
  const undone = await deps.charges.undoLatest({
    actorId: deps.userId,
    propertyId,
    chargeId,
    latestStart: latest.validFrom,
    previousStart: previous?.validFrom ?? null,
  })
  if (!undone) {
    return (await roleCheck(deps, propertyId)) ?? changedMeanwhile
  }
  deps.log.info(
    previous ? 'usage_charge.change_undone' : 'usage_charge.removed',
    { propertyId, usageChargeId: chargeId },
  )
  return { ok: true }
}
