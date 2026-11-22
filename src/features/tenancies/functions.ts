// Server functions for tenancies, called by the Tenancy page and its forms.
// The logic is in tenancies.server.ts; these validate the input with the
// shared schemas, check the session and wire in the request context.
import { createServerFn } from '@tanstack/react-start'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { recurringAmountRepository } from '#/features/recurring-amounts/recurring-amount.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { getRequestContext } from '#/server/platform/context.server'
import {
  createTenancyInput,
  endTenancyInput,
  propertyRefInput,
  tenancyRefInput,
  updateTenancyInput,
} from './schemas'
import {
  cancelTenancyEnding as cancel,
  createTenancy as create,
  endTenancy as end,
  getNewTenancyOptions as newOptions,
  getTenancies as getList,
  getTenancy as getOne,
  updateTenancy as update,
  type TenancyDeps,
} from './tenancies.server'
import { tenancyRepository } from './tenancy.repository.server'

/**
 * The signed-in user's dependencies. Pages are protected by the signed-in
 * layout, endpoints are not: without a session this throws.
 */
async function tenancyDeps(): Promise<TenancyDeps> {
  const context = getRequestContext()
  const session = await context.auth.getSession()
  if (!session) {
    throw new Error('Not signed in')
  }
  return {
    userId: session.user.id,
    tenancies: tenancyRepository(context.db),
    amounts: recurringAmountRepository(context.db),
    properties: propertyRepository(context.db),
    ownership: ownershipRepository(context.db),
    sharing: sharingRepository(context.db),
    log: context.log,
    now: () => new Date(),
  }
}

export const getTenancies = createServerFn({ method: 'GET' })
  .validator(propertyRefInput)
  .handler(async ({ data }) => getList(await tenancyDeps(), data.propertyId))

export const getNewTenancyOptions = createServerFn({ method: 'GET' })
  .validator(propertyRefInput)
  .handler(async ({ data }) => newOptions(await tenancyDeps(), data.propertyId))

export const getTenancy = createServerFn({ method: 'GET' })
  .validator(tenancyRefInput)
  .handler(async ({ data }) =>
    getOne(await tenancyDeps(), data.propertyId, data.tenancyId),
  )

export const createTenancy = createServerFn({ method: 'POST' })
  .validator(createTenancyInput)
  .handler(async ({ data }) => {
    const { propertyId, rent, ...fields } = data
    return create(await tenancyDeps(), propertyId, fields, rent)
  })

export const updateTenancy = createServerFn({ method: 'POST' })
  .validator(updateTenancyInput)
  .handler(async ({ data }) => {
    const { propertyId, tenancyId, ...fields } = data
    return update(await tenancyDeps(), propertyId, tenancyId, fields)
  })

export const endTenancy = createServerFn({ method: 'POST' })
  .validator(endTenancyInput)
  .handler(async ({ data }) => {
    const { propertyId, tenancyId, ...ending } = data
    return end(await tenancyDeps(), propertyId, tenancyId, ending)
  })

export const cancelTenancyEnding = createServerFn({ method: 'POST' })
  .validator(tenancyRefInput)
  .handler(async ({ data }) =>
    cancel(await tenancyDeps(), data.propertyId, data.tenancyId),
  )
