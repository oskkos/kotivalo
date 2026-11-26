// Server functions for deposit returns, called by the return page. The logic
// is in deposits.server.ts; these validate the input with the shared
// schemas, check the session and wire in the request context.
import { createServerFn } from '@tanstack/react-start'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { rentPaymentRepository } from '#/features/rent-payments/rent-payment.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { tenancyRepository } from '#/features/tenancies/tenancy.repository.server'
import { getRequestContext } from '#/server/platform/context.server'
import { depositReturnRepository } from './deposit-return.repository.server'
import {
  deleteDepositReturn as remove,
  getDepositReturn as getOne,
  recordDepositReturn as record,
  updateDepositReturn as update,
  type DepositDeps,
} from './deposits.server'
import { depositReturnInput, depositReturnRefInput } from './schemas'

/**
 * The signed-in user's dependencies. Pages are protected by the signed-in
 * layout, endpoints are not: without a session this throws.
 */
async function depositDeps(): Promise<DepositDeps> {
  const context = getRequestContext()
  const session = await context.auth.getSession()
  if (!session) {
    throw new Error('Not signed in')
  }
  return {
    userId: session.user.id,
    deposits: depositReturnRepository(context.db),
    payments: rentPaymentRepository(context.db),
    tenancies: tenancyRepository(context.db),
    properties: propertyRepository(context.db),
    sharing: sharingRepository(context.db),
    log: context.log,
    now: () => new Date(),
  }
}

export const getDepositReturn = createServerFn({ method: 'GET' })
  .validator(depositReturnRefInput)
  .handler(async ({ data }) =>
    getOne(await depositDeps(), data.propertyId, data.tenancyId),
  )

export const recordDepositReturn = createServerFn({ method: 'POST' })
  .validator(depositReturnInput)
  .handler(async ({ data }) => {
    const { propertyId, tenancyId, ...fields } = data
    return record(await depositDeps(), propertyId, tenancyId, fields)
  })

export const updateDepositReturn = createServerFn({ method: 'POST' })
  .validator(depositReturnInput)
  .handler(async ({ data }) => {
    const { propertyId, tenancyId, ...fields } = data
    return update(await depositDeps(), propertyId, tenancyId, fields)
  })

export const deleteDepositReturn = createServerFn({ method: 'POST' })
  .validator(depositReturnRefInput)
  .handler(async ({ data }) =>
    remove(await depositDeps(), data.propertyId, data.tenancyId),
  )
