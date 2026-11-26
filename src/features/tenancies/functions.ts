// Server functions for tenancies, called by the Tenancy page and its forms.
// The logic is in tenancies.server.ts; these validate the input with the
// shared schemas, check the session and wire in the request context.
import { createServerFn } from '@tanstack/react-start'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { getRequestContext } from '#/server/platform/context.server'
import {
  addTenantFeeInput,
  createTenancyInput,
  endTenancyInput,
  propertyRefInput,
  setTenancyOccupantsInput,
  setTenancyRentInput,
  setTenantFeeInput,
  tenancyRefInput,
  tenantFeeRefInput,
  updateTenancyInput,
} from './schemas'
import {
  addTenantFee as addFee,
  cancelTenancyEnding as cancel,
  createTenancy as create,
  endTenancy as end,
  getNewTenancyOptions as newOptions,
  getTenancies as getList,
  getTenancy as getOne,
  listTenancyStatuses as listStatuses,
  removeTenancy as remove,
  setTenancyOccupants as setOccupants,
  setTenancyRent as setRent,
  setTenantFee as setFee,
  undoTenantFee as undoFee,
  undoTenancyOccupants as undoOccupants,
  undoTenancyRent as undoRent,
  updateTenancy as update,
  type TenancyDeps,
} from './tenancies.server'
import { documentRepository } from '#/features/documents/document.repository.server'
import { depositReturnRepository } from '#/features/deposits/deposit-return.repository.server'
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
    depositReturns: depositReturnRepository(context.db),
    documents: documentRepository(context.db),
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
    const { propertyId, rent, occupants, ending, copyFeeIds, ...fields } = data
    return create(
      await tenancyDeps(),
      propertyId,
      fields,
      rent,
      occupants,
      ending,
      copyFeeIds,
    )
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

export const removeTenancy = createServerFn({ method: 'POST' })
  .validator(tenancyRefInput)
  .handler(async ({ data }) =>
    remove(await tenancyDeps(), data.propertyId, data.tenancyId),
  )

export const listTenancyStatuses = createServerFn({ method: 'GET' }).handler(
  async () => listStatuses(await tenancyDeps()),
)

export const setTenancyRent = createServerFn({ method: 'POST' })
  .validator(setTenancyRentInput)
  .handler(async ({ data }) => {
    const { propertyId, tenancyId, amount, from } = data
    return setRent(await tenancyDeps(), propertyId, tenancyId, { amount, from })
  })

export const undoTenancyRent = createServerFn({ method: 'POST' })
  .validator(tenancyRefInput)
  .handler(async ({ data }) =>
    undoRent(await tenancyDeps(), data.propertyId, data.tenancyId),
  )

export const setTenancyOccupants = createServerFn({ method: 'POST' })
  .validator(setTenancyOccupantsInput)
  .handler(async ({ data }) => {
    const { propertyId, tenancyId, persons, from } = data
    return setOccupants(await tenancyDeps(), propertyId, tenancyId, {
      persons,
      from,
    })
  })

export const undoTenancyOccupants = createServerFn({ method: 'POST' })
  .validator(tenancyRefInput)
  .handler(async ({ data }) =>
    undoOccupants(await tenancyDeps(), data.propertyId, data.tenancyId),
  )

export const addTenantFee = createServerFn({ method: 'POST' })
  .validator(addTenantFeeInput)
  .handler(async ({ data }) => {
    const { propertyId, tenancyId, kind, basis, description, amount, from } =
      data
    return addFee(await tenancyDeps(), propertyId, tenancyId, {
      kind,
      basis,
      description,
      amount,
      from,
    })
  })

export const setTenantFee = createServerFn({ method: 'POST' })
  .validator(setTenantFeeInput)
  .handler(async ({ data }) => {
    const { propertyId, tenancyId, feeId, amount, from } = data
    return setFee(await tenancyDeps(), propertyId, tenancyId, feeId, {
      amount,
      from,
    })
  })

export const undoTenantFee = createServerFn({ method: 'POST' })
  .validator(tenantFeeRefInput)
  .handler(async ({ data }) =>
    undoFee(await tenancyDeps(), data.propertyId, data.tenancyId, data.feeId),
  )
