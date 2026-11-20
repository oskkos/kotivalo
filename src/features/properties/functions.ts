// Server functions for flats, called by the flats pages. The logic is in
// properties.server.ts; these validate the input with the shared schemas,
// check the session and wire in the request context.
import { createServerFn } from '@tanstack/react-start'
import { INTL_LOCALES } from '#/lib/format'
import { getLocale } from '#/paraglide/runtime.js'
import { getRequestContext } from '#/server/platform/context.server'
import { propertyRepository } from './property.repository.server'
import {
  createProperty as create,
  getProperty as get,
  listProperties as list,
  updateProperty as update,
  type PropertyDeps,
} from './properties.server'
import {
  newPropertyInput,
  propertyIdInput,
  updatePropertyInput,
} from './schemas'

/**
 * The signed-in user's dependencies. Pages are protected by the signed-in
 * layout, endpoints are not: without a session this throws.
 */
async function propertyDeps(): Promise<PropertyDeps> {
  const context = getRequestContext()
  const session = await context.auth.getSession()
  if (!session) {
    throw new Error('Not signed in')
  }
  return {
    userId: session.user.id,
    properties: propertyRepository(context.db),
    log: context.log,
    now: () => new Date(),
    collation: INTL_LOCALES[getLocale()],
  }
}

export const listProperties = createServerFn({ method: 'GET' }).handler(
  async () => list(await propertyDeps()),
)

export const getProperty = createServerFn({ method: 'GET' })
  .validator(propertyIdInput)
  .handler(async ({ data }) => get(await propertyDeps(), data.id))

export const createProperty = createServerFn({ method: 'POST' })
  .validator(newPropertyInput)
  .handler(async ({ data: { ownedSince, ...details } }) =>
    create(await propertyDeps(), details, ownedSince),
  )

export const updateProperty = createServerFn({ method: 'POST' })
  .validator(updatePropertyInput)
  .handler(async ({ data: { id, ...details } }) =>
    update(await propertyDeps(), id, details),
  )
