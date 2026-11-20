// Flats: the logic behind the server functions in functions.ts, with its
// dependencies passed in so Workers tests can drive it (openspec: properties).
import { isoDateInFinland, type IsoDate } from '#/lib/dates'
import type { AlertReason } from '#/lib/reasons'
import type { Logger } from '#/server/log/log'
import {
  sortByStreetAddress,
  type Property,
  type PropertyDetails,
} from './property'
import type { PropertyRepository } from './property.repository.server'

export interface PropertyDeps {
  /** The signed-in user. */
  userId: string
  properties: PropertyRepository
  log: Logger
  now: () => Date
  /** The Intl locale to sort addresses in. */
  collation: string
}

/**
 * Kotivalo is made for 1–10 flats; this bounds what one account can store
 * under open sign-up (spec: "Limiting the number of flats").
 */
export const PROPERTY_LIMIT = 100

type Result<T> =
  | ({ ok: true } & T)
  | { ok: false; reason: Extract<AlertReason, `property_${string}`> }

const notFound = { ok: false, reason: 'property_not_found' } as const

export async function listProperties(deps: PropertyDeps): Promise<Property[]> {
  return sortByStreetAddress(
    await deps.properties.listForUser(deps.userId),
    deps.collation,
  )
}

export async function getProperty(
  deps: PropertyDeps,
  id: string,
): Promise<Result<{ property: Property }>> {
  const property = await deps.properties.findForUser(deps.userId, id)
  return property ? { ok: true, property } : notFound
}

/**
 * Adds a flat owned 100 % by the user from `ownedSince`, today in Finland
 * when not given (spec: "The first ownership period").
 */
export async function createProperty(
  deps: PropertyDeps,
  details: PropertyDetails,
  ownedSince?: IsoDate,
): Promise<Result<{ id: string }>> {
  // The count and the insert are separate statements, so two requests at
  // once can pass 100 by one; the limit bounds abuse, it is not a rule
  // (design decision 4).
  if ((await deps.properties.countForUser(deps.userId)) >= PROPERTY_LIMIT) {
    deps.log.warn('property.limit_reached', { limit: PROPERTY_LIMIT })
    return { ok: false, reason: 'property_limit_reached' }
  }
  const now = deps.now()
  const { id } = await deps.properties.create(
    deps.userId,
    details,
    now,
    ownedSince ?? isoDateInFinland(now),
  )
  deps.log.info('property.created', { propertyId: id })
  return { ok: true, id }
}

export async function updateProperty(
  deps: PropertyDeps,
  id: string,
  details: PropertyDetails,
): Promise<Result<{ id: string }>> {
  if (!(await deps.properties.update(deps.userId, id, details, deps.now()))) {
    return notFound
  }
  deps.log.info('property.updated', { propertyId: id })
  return { ok: true, id }
}
