// Deposit returns: the logic behind the server functions in functions.ts,
// with its dependencies passed in so Workers tests can drive it (openspec:
// deposits). The rules are checked here first for the reason, and each write
// checks the owner role and the tenancy again in its statements. Amounts,
// notes and names are never logged.
import type { Property } from '#/features/properties/property'
import type { PropertyRepository } from '#/features/properties/property.repository.server'
import type { RentPaymentRepository } from '#/features/rent-payments/rent-payment.repository.server'
import type { SharingRepository } from '#/features/sharing/sharing.repository.server'
import type {
  Tenancy,
  TenancyRepository,
} from '#/features/tenancies/tenancy.repository.server'
import { isoDateInFinland, type IsoDate } from '#/lib/dates'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import type { PropertyRole } from '#/server/db/schema'
import type { Logger } from '#/server/log/log'
import {
  allocateRentKept,
  checkReturn,
  checkReturnFields,
  missingRent,
  type MissingMonth,
} from './deposit'
import type {
  DepositReturn,
  DepositReturnFields,
  DepositReturnRepository,
} from './deposit-return.repository.server'

export interface DepositDeps {
  /** The signed-in user. */
  userId: string
  deposits: DepositReturnRepository
  payments: RentPaymentRepository
  tenancies: TenancyRepository
  properties: PropertyRepository
  sharing: SharingRepository
  log: Logger
  now: () => Date
}

interface Failure<R extends FieldReason | AlertReason = AlertReason> {
  ok: false
  reason: R
}

const fail = <R extends FieldReason | AlertReason>(reason: R): Failure<R> => ({
  ok: false,
  reason,
})

const notFound = fail('property_not_found')
const ownerOnly = fail('sharing_owner_only')
const tenancyNotFound = fail('tenancy_not_found')

const today = (deps: DepositDeps) => isoDateInFinland(deps.now())

async function roleCheck(
  deps: DepositDeps,
  propertyId: string,
): Promise<typeof notFound | typeof ownerOnly | undefined> {
  const role = await deps.sharing.roleOf(deps.userId, propertyId)
  if (!role) {
    return notFound
  }
  return role === 'owner' ? undefined : ownerOnly
}

/** What the return page shows. */
export interface DepositReturnView {
  role: PropertyRole
  property: Property
  /** Today in Finland. */
  today: IsoDate
  tenancy: Tenancy
  /** The recorded return, if any. */
  depositReturn: DepositReturn | undefined
  /**
   * The rent missing from the tenancy's months, oldest first, without the
   * return's own payments. Empty while the tenancy has no last rent day.
   */
  missing: MissingMonth[]
}

/** The months with rent missing, leaving out the return's own payments. */
async function missingFor(
  deps: DepositDeps,
  propertyId: string,
  tenancy: Tenancy,
  returnId: string | undefined,
): Promise<MissingMonth[]> {
  if (tenancy.validTo === null) {
    return []
  }
  const [rents, occupants, fees, payments] = await Promise.all([
    deps.tenancies.rentsFor([tenancy.id]),
    deps.tenancies.occupantsFor([tenancy.id]),
    deps.tenancies.feesFor([tenancy.id]),
    deps.payments.forProperty(propertyId),
  ])
  return missingRent(
    { ...tenancy, validTo: tenancy.validTo },
    {
      rents,
      occupants,
      fees,
      payments: payments.filter(
        (p) =>
          p.tenancyId === tenancy.id &&
          (returnId === undefined || p.depositReturnId !== returnId),
      ),
    },
  )
}

/** A tenancy of the flat with its return and the rent missing. */
export async function getDepositReturn(
  deps: DepositDeps,
  propertyId: string,
  tenancyId: string,
): Promise<
  ({ ok: true } & DepositReturnView) | typeof notFound | typeof tenancyNotFound
> {
  const [role, property, tenancy] = await Promise.all([
    deps.sharing.roleOf(deps.userId, propertyId),
    deps.properties.findForUser(deps.userId, propertyId),
    deps.tenancies.get(tenancyId),
  ])
  if (!role || !property) {
    return notFound
  }
  if (tenancy?.propertyId !== propertyId) {
    return tenancyNotFound
  }
  const depositReturn = await deps.deposits.forTenancy(tenancyId)
  return {
    ok: true,
    role,
    property,
    today: today(deps),
    tenancy,
    depositReturn,
    missing: await missingFor(deps, propertyId, tenancy, depositReturn?.id),
  }
}

export interface ReturnInputFields extends DepositReturnFields {
  deductions: boolean
}

/** The stored fields of an input. */
const fieldsOf = (input: ReturnInputFields): DepositReturnFields => ({
  returnedOn: input.returnedOn,
  rentKept: input.rentKept,
  damageKept: input.damageKept,
  note: input.note,
})

/** Records the return of a tenancy's deposit. Owners only. */
export async function recordDepositReturn(
  deps: DepositDeps,
  propertyId: string,
  tenancyId: string,
  input: ReturnInputFields,
): Promise<
  { ok: true; returnId: string } | Failure<FieldReason | AlertReason>
> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const tenancy = await deps.tenancies.get(tenancyId)
  if (tenancy?.propertyId !== propertyId) {
    return tenancyNotFound
  }
  const existing = await deps.deposits.forTenancy(tenancyId)
  const problem = checkReturn({
    ...input,
    deposit: tenancy.deposit ?? null,
    lastRentDay: tenancy.validTo,
    hasReturn: existing !== undefined,
    today: today(deps),
  })
  if (problem) {
    return fail(problem)
  }
  const allocation = allocateRentKept(
    await missingFor(deps, propertyId, tenancy, undefined),
    input.rentKept,
  )
  if (!allocation.ok) {
    return fail(allocation.reason)
  }
  const fields = fieldsOf(input)
  const returnId = await deps.deposits.record(
    deps.userId,
    propertyId,
    tenancyId,
    fields,
    allocation.payments,
    deps.now(),
  )
  if (returnId === null) {
    // The role, the tenancy or a return recorded meanwhile.
    return (await roleCheck(deps, propertyId)) ?? fail('deposit_return_exists')
  }
  deps.log.info('deposit.return_recorded', { propertyId, tenancyId, returnId })
  return { ok: true, returnId }
}

/** Corrects the recorded return of a tenancy. Owners only. */
export async function updateDepositReturn(
  deps: DepositDeps,
  propertyId: string,
  tenancyId: string,
  input: ReturnInputFields,
): Promise<{ ok: true } | Failure<FieldReason | AlertReason>> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const tenancy = await deps.tenancies.get(tenancyId)
  if (tenancy?.propertyId !== propertyId) {
    return tenancyNotFound
  }
  const existing = await deps.deposits.forTenancy(tenancyId)
  if (existing === undefined) {
    return tenancyNotFound
  }
  if (tenancy.deposit == null || tenancy.validTo === null) {
    return fail('deposit_not_set')
  }
  const problem = checkReturnFields({
    ...input,
    deposit: tenancy.deposit,
    lastRentDay: tenancy.validTo,
    today: today(deps),
  })
  if (problem) {
    return fail(problem)
  }
  const allocation = allocateRentKept(
    await missingFor(deps, propertyId, tenancy, existing.id),
    input.rentKept,
  )
  if (!allocation.ok) {
    return fail(allocation.reason)
  }
  const fields = fieldsOf(input)
  const updated = await deps.deposits.update(
    deps.userId,
    propertyId,
    existing.id,
    fields,
    allocation.payments,
    deps.now(),
  )
  if (!updated) {
    return (await roleCheck(deps, propertyId)) ?? tenancyNotFound
  }
  deps.log.info('deposit.return_updated', {
    propertyId,
    tenancyId,
    returnId: existing.id,
  })
  return { ok: true }
}

/** Deletes the recorded return of a tenancy, and its payments. Owners only. */
export async function deleteDepositReturn(
  deps: DepositDeps,
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
  const existing = await deps.deposits.forTenancy(tenancyId)
  if (existing === undefined) {
    return tenancyNotFound
  }
  const removed = await deps.deposits.remove(
    deps.userId,
    propertyId,
    existing.id,
  )
  if (!removed) {
    return (await roleCheck(deps, propertyId)) ?? tenancyNotFound
  }
  deps.log.info('deposit.return_deleted', {
    propertyId,
    tenancyId,
    returnId: existing.id,
  })
  return { ok: true }
}
