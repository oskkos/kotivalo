// Rent payments: the logic behind the server functions in functions.ts,
// with its dependencies passed in so Workers tests can drive it (openspec:
// rent-payments). The rules are checked here first for the reason, and each
// write checks the owner role and the tenancy's months again in its
// statement. Amounts and names are never logged.
import type { Property } from '#/features/properties/property'
import type { PropertyRepository } from '#/features/properties/property.repository.server'
import type { RecurringAmountRepository } from '#/features/recurring-amounts/recurring-amount.repository.server'
import type { Period } from '#/features/recurring-amounts/periods'
import type { SharingRepository } from '#/features/sharing/sharing.repository.server'
import type {
  Tenancy,
  TenancyRepository,
} from '#/features/tenancies/tenancy.repository.server'
import { isoDateInFinland, type IsoDate } from '#/lib/dates'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import type { PropertyRole } from '#/server/db/schema'
import type { Logger } from '#/server/log/log'
import type {
  NewRentPayment,
  RentPayment,
  RentPaymentRepository,
} from './rent-payment.repository.server'
import { tenancyMonths } from './status'

export interface RentPaymentDeps {
  /** The signed-in user. */
  userId: string
  payments: RentPaymentRepository
  tenancies: TenancyRepository
  amounts: RecurringAmountRepository
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
const outsideTenancy = fail('rent_payment_month_outside_tenancy')

const today = (deps: RentPaymentDeps) => isoDateInFinland(deps.now())

/** What the rent pages compute the months and statuses from. */
export interface RentPaymentsView {
  role: PropertyRole
  property: Property
  /** Today in Finland. */
  today: IsoDate
  /** Newest first. */
  tenancies: Tenancy[]
  /** The flat's rent periods, oldest first. */
  rents: Period<number>[]
  /** Every payment of the flat's tenancies, by month and payment date. */
  payments: RentPayment[]
}

/** The flat's tenancies, rent and payments, for everyone with access. */
export async function getRentPayments(
  deps: RentPaymentDeps,
  propertyId: string,
): Promise<({ ok: true } & RentPaymentsView) | typeof notFound> {
  const [role, property, tenancies, amounts, payments] = await Promise.all([
    deps.sharing.roleOf(deps.userId, propertyId),
    deps.properties.findForUser(deps.userId, propertyId),
    deps.tenancies.forProperty(propertyId),
    deps.amounts.forProperty(propertyId),
    deps.payments.forProperty(propertyId),
  ])
  if (!role || !property) {
    return notFound
  }
  return {
    ok: true,
    role,
    property,
    today: today(deps),
    tenancies,
    rents: amounts.amounts.rent,
    payments,
  }
}

/** Whether the tenancy runs in `month`. */
const runsIn = (tenancy: Tenancy, month: string) =>
  tenancyMonths(tenancy, month, month).length > 0

/** One month of a tenancy: the view narrowed to it. */
export async function getRentMonth(
  deps: RentPaymentDeps,
  propertyId: string,
  tenancyId: string,
  month: string,
): Promise<
  | ({ ok: true; tenancy: Tenancy; month: string } & RentPaymentsView)
  | typeof notFound
  | typeof tenancyNotFound
  | typeof outsideTenancy
> {
  const view = await getRentPayments(deps, propertyId)
  if (!view.ok) {
    return view
  }
  const tenancy = view.tenancies.find((t) => t.id === tenancyId)
  if (!tenancy) {
    return tenancyNotFound
  }
  if (!runsIn(tenancy, month)) {
    return outsideTenancy
  }
  return {
    ...view,
    tenancy,
    month,
    payments: view.payments.filter(
      (p) => p.tenancyId === tenancyId && p.month === month,
    ),
  }
}

async function roleCheck(
  deps: RentPaymentDeps,
  propertyId: string,
): Promise<typeof notFound | typeof ownerOnly | undefined> {
  const role = await deps.sharing.roleOf(deps.userId, propertyId)
  if (!role) {
    return notFound
  }
  return role === 'owner' ? undefined : ownerOnly
}

/** Records a payment for a month of a tenancy. Owners only. */
export async function recordRentPayment(
  deps: RentPaymentDeps,
  propertyId: string,
  payment: NewRentPayment,
): Promise<
  { ok: true; paymentId: string } | Failure<FieldReason | AlertReason>
> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const tenancy = await deps.tenancies.get(payment.tenancyId)
  if (tenancy?.propertyId !== propertyId) {
    return tenancyNotFound
  }
  if (payment.paidOn > today(deps)) {
    return fail('rent_payment_date_in_future')
  }
  if (!runsIn(tenancy, payment.month)) {
    return outsideTenancy
  }
  const paymentId = await deps.payments.record(
    deps.userId,
    propertyId,
    payment,
    deps.now(),
  )
  if (paymentId === null) {
    // The role or the tenancy changed between the checks and the write.
    return (await roleCheck(deps, propertyId)) ?? outsideTenancy
  }
  deps.log.info('rent_payment.recorded', {
    propertyId,
    tenancyId: payment.tenancyId,
    paymentId,
  })
  return { ok: true, paymentId }
}

/** Deletes a payment of one of the flat's tenancies. Owners only. */
export async function deleteRentPayment(
  deps: RentPaymentDeps,
  propertyId: string,
  paymentId: string,
): Promise<{ ok: true } | Failure> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const removed = await deps.payments.remove(deps.userId, propertyId, paymentId)
  if (!removed) {
    return (await roleCheck(deps, propertyId)) ?? fail('rent_payment_not_found')
  }
  deps.log.info('rent_payment.deleted', { propertyId, paymentId })
  return { ok: true }
}
