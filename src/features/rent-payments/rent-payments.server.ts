// Rent payments: the logic behind the server functions in functions.ts,
// with its dependencies passed in so Workers tests can drive it (openspec:
// rent-payments). The rules are checked here first for the reason, and each
// write checks the owner role and the tenancy's months again in its
// statement. Amounts and names are never logged.
import type { Property } from '#/features/properties/property'
import type { PropertyRepository } from '#/features/properties/property.repository.server'
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
import { tenancyMonths, type FlatRentData, type RentsByTenancy } from './status'

export interface RentPaymentDeps {
  /** The signed-in user. */
  userId: string
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
  /** Each tenancy's rent periods, oldest first. */
  rents: RentsByTenancy
  /** Every payment of the flat's tenancies, by month and payment date. */
  payments: RentPayment[]
}

/** The flat's tenancies, rent and payments, for everyone with access. */
export async function getRentPayments(
  deps: RentPaymentDeps,
  propertyId: string,
): Promise<({ ok: true } & RentPaymentsView) | typeof notFound> {
  const [role, property, tenancies, payments] = await Promise.all([
    deps.sharing.roleOf(deps.userId, propertyId),
    deps.properties.findForUser(deps.userId, propertyId),
    deps.tenancies.forProperty(propertyId),
    deps.payments.forProperty(propertyId),
  ])
  if (!role || !property) {
    return notFound
  }
  const rents = await deps.tenancies.rentsFor(tenancies.map((t) => t.id))
  return {
    ok: true,
    role,
    property,
    today: today(deps),
    tenancies,
    rents,
    payments,
  }
}

/** This month's rent data of every flat the user has access to. */
export interface RentThisMonthView {
  today: IsoDate
  flats: FlatRentData<Tenancy>[]
}

/**
 * For the flats list: the user's flats with the tenancies running this
 * month, their rent periods and this month's payments (openspec:
 * rent-payments, "The rent summary on the flats list"). Access is checked
 * once by listing the user's flats; every other read is by their ids.
 */
export async function listRentThisMonth(
  deps: RentPaymentDeps,
): Promise<RentThisMonthView> {
  const day = today(deps)
  const month = day.slice(0, 7)
  const ids = (await deps.properties.listForUser(deps.userId)).map(
    (flat) => flat.id,
  )
  const [tenancies, payments] = await Promise.all([
    deps.tenancies.currentFor(ids, `${month}-01`),
    deps.payments.forMonth(ids, month),
  ])
  const rents = await deps.tenancies.rentsFor(tenancies.map((t) => t.id))
  return {
    today: day,
    flats: ids.map((propertyId) => ({
      propertyId,
      tenancies: tenancies.filter((t) => t.propertyId === propertyId),
      rents,
      payments: payments
        .filter((p) => p.propertyId === propertyId)
        .map(({ tenancyId, month, amount, paidOn }) => ({
          tenancyId,
          month,
          amount,
          paidOn,
        })),
    })),
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
