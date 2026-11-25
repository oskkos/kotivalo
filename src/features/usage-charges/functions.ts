// Server functions for usage charges, called by the usage charge pages and
// forms. The logic is in usage-charges.server.ts; these validate the input
// with the shared schemas, check the session and wire in the request context.
import { createServerFn } from '@tanstack/react-start'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { tenancyRepository } from '#/features/tenancies/tenancy.repository.server'
import { getRequestContext } from '#/server/platform/context.server'
import {
  addUsageChargeInput,
  propertyRefInput,
  setUsageChargeInput,
  usageChargeRefInput,
} from './schemas'
import { usageChargeRepository } from './usage-charge.repository.server'
import {
  addUsageCharge as add,
  getUsageCharges as get,
  setUsageCharge as set,
  undoUsageCharge as undo,
  type UsageChargeDeps,
} from './usage-charges.server'

/**
 * The signed-in user's dependencies. Pages are protected by the signed-in
 * layout, endpoints are not: without a session this throws.
 */
async function usageChargeDeps(): Promise<UsageChargeDeps> {
  const context = getRequestContext()
  const session = await context.auth.getSession()
  if (!session) {
    throw new Error('Not signed in')
  }
  return {
    userId: session.user.id,
    charges: usageChargeRepository(context.db),
    tenancies: tenancyRepository(context.db),
    properties: propertyRepository(context.db),
    ownership: ownershipRepository(context.db),
    sharing: sharingRepository(context.db),
    log: context.log,
    now: () => new Date(),
  }
}

export const getUsageCharges = createServerFn({ method: 'GET' })
  .validator(propertyRefInput)
  .handler(async ({ data }) => get(await usageChargeDeps(), data.propertyId))

export const addUsageCharge = createServerFn({ method: 'POST' })
  .validator(addUsageChargeInput)
  .handler(async ({ data }) => {
    const { propertyId, kind, basis, description, amount, from } = data
    return add(await usageChargeDeps(), propertyId, {
      kind,
      basis,
      description,
      amount,
      from,
    })
  })

export const setUsageCharge = createServerFn({ method: 'POST' })
  .validator(setUsageChargeInput)
  .handler(async ({ data }) =>
    set(await usageChargeDeps(), data.propertyId, data.chargeId, {
      amount: data.amount,
      from: data.from,
    }),
  )

export const undoUsageCharge = createServerFn({ method: 'POST' })
  .validator(usageChargeRefInput)
  .handler(async ({ data }) =>
    undo(await usageChargeDeps(), data.propertyId, data.chargeId),
  )
