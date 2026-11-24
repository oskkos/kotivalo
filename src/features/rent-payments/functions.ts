// Server functions for rent payments, called by the flats list, the flat
// details page, the month's payments page and the rent payments page. The logic is in
// rent-payments.server.ts; these validate the input with the shared schemas,
// check the session and wire in the request context.
import { createServerFn } from '@tanstack/react-start'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { tenancyRepository } from '#/features/tenancies/tenancy.repository.server'
import { getRequestContext } from '#/server/platform/context.server'
import { rentPaymentRepository } from './rent-payment.repository.server'
import {
  deleteRentPayment as remove,
  getRentMonth as getMonth,
  getRentPayments as getList,
  listRentThisMonth as listThisMonth,
  recordRentPayment as record,
  type RentPaymentDeps,
} from './rent-payments.server'
import {
  deleteRentPaymentInput,
  recordRentPaymentInput,
  rentMonthInput,
  rentPaymentsInput,
} from './schemas'

/**
 * The signed-in user's dependencies. Pages are protected by the signed-in
 * layout, endpoints are not: without a session this throws.
 */
async function rentPaymentDeps(): Promise<RentPaymentDeps> {
  const context = getRequestContext()
  const session = await context.auth.getSession()
  if (!session) {
    throw new Error('Not signed in')
  }
  return {
    userId: session.user.id,
    payments: rentPaymentRepository(context.db),
    tenancies: tenancyRepository(context.db),
    properties: propertyRepository(context.db),
    sharing: sharingRepository(context.db),
    log: context.log,
    now: () => new Date(),
  }
}

export const getRentPayments = createServerFn({ method: 'GET' })
  .validator(rentPaymentsInput)
  .handler(async ({ data }) =>
    getList(await rentPaymentDeps(), data.propertyId),
  )

export const listRentThisMonth = createServerFn({ method: 'GET' }).handler(
  async () => listThisMonth(await rentPaymentDeps()),
)

export const getRentMonth = createServerFn({ method: 'GET' })
  .validator(rentMonthInput)
  .handler(async ({ data }) =>
    getMonth(
      await rentPaymentDeps(),
      data.propertyId,
      data.tenancyId,
      data.month,
    ),
  )

export const recordRentPayment = createServerFn({ method: 'POST' })
  .validator(recordRentPaymentInput)
  .handler(async ({ data }) => {
    const { propertyId, ...payment } = data
    return record(await rentPaymentDeps(), propertyId, payment)
  })

export const deleteRentPayment = createServerFn({ method: 'POST' })
  .validator(deleteRentPaymentInput)
  .handler(async ({ data }) =>
    remove(await rentPaymentDeps(), data.propertyId, data.paymentId),
  )
