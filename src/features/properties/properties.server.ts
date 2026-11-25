// Flats: the logic behind the server functions in functions.ts, with its
// dependencies passed in so Workers tests can drive it (openspec: properties).
import { isoDateInFinland, type IsoDate } from '#/lib/dates'
import type { AlertReason } from '#/lib/reasons'
import { deleteStoredFiles } from '#/server/files/delete'
import type { FileStorage } from '#/server/files/storage'
import type { Logger } from '#/server/log/log'
import {
  sortByStreetAddress,
  type ArchivedProperty,
  type Property,
  type PropertyDetails,
} from './property'
import type {
  DeletionSummary,
  PropertyRepository,
} from './property.repository.server'

export interface PropertyDeps {
  /** The signed-in user. */
  userId: string
  properties: PropertyRepository
  /** Where the receipt files are, for deleting a flat. */
  storage: FileStorage
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

export interface PropertyLists {
  /** The flats the user hasn't archived, by street address. */
  properties: Property[]
  /** The flats the user has archived, by street address. */
  archived: ArchivedProperty[]
}

export async function listProperties(
  deps: PropertyDeps,
): Promise<PropertyLists> {
  const [active, archived] = await Promise.all([
    deps.properties.listForUser(deps.userId),
    deps.properties.listArchivedForUser(deps.userId),
  ])
  return {
    properties: sortByStreetAddress(active, deps.collation),
    archived: sortByStreetAddress(
      archived.map(({ archivedAt, ...flat }) => ({
        ...flat,
        archivedOn: isoDateInFinland(archivedAt ?? deps.now()),
      })),
      deps.collation,
    ),
  }
}

export async function getProperty(
  deps: PropertyDeps,
  id: string,
): Promise<Result<{ property: Property }>> {
  const found = await deps.properties.findForUser(deps.userId, id)
  if (!found) {
    return notFound
  }
  return {
    ok: true,
    property: {
      id: found.id,
      streetAddress: found.streetAddress,
      postcode: found.postcode,
      city: found.city,
      roomCount: found.roomCount,
      floorArea: found.floorArea,
    },
  }
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

/** Archives the flat for the user only (spec: "Archiving a flat"). */
export async function archiveProperty(
  deps: PropertyDeps,
  id: string,
): Promise<Result<object>> {
  const result = await deps.properties.setArchived(deps.userId, id, deps.now())
  if (result === 'not_found') {
    return notFound
  }
  if (result === 'changed') {
    deps.log.info('property.archived', { propertyId: id })
  }
  return { ok: true }
}

/** Brings an archived flat back to the user's views. */
export async function restoreProperty(
  deps: PropertyDeps,
  id: string,
): Promise<Result<object>> {
  const result = await deps.properties.setArchived(deps.userId, id, null)
  if (result === 'not_found') {
    return notFound
  }
  if (result === 'changed') {
    deps.log.info('property.restored', { propertyId: id })
  }
  return { ok: true }
}

type DeletionRefusal =
  | { allowed: false; reason: 'sharing_owner_only'; otherOwners: string[] }
  | {
      allowed: false
      reason: 'property_delete_other_owners'
      otherOwners: string[]
    }

export type PropertyDeletion =
  | ({ ok: true; allowed: true } & DeletionSummary)
  | ({ ok: true } & DeletionRefusal)
  | typeof notFound

/** Whether the user may delete the flat, as `allowed` with its reason. */
async function refusalFor(
  deps: PropertyDeps,
  id: string,
): Promise<DeletionRefusal | 'not_found' | undefined> {
  const { role, otherOwners } = await deps.properties.deletionCheck(
    deps.userId,
    id,
  )
  if (role === undefined) {
    return 'not_found'
  }
  if (role !== 'owner') {
    return { allowed: false, reason: 'sharing_owner_only', otherOwners: [] }
  }
  if (otherOwners.length > 0) {
    return {
      allowed: false,
      reason: 'property_delete_other_owners',
      otherOwners,
    }
  }
  return undefined
}

/** What the deletion confirmation shows (spec: "Confirming the deletion of a flat"). */
export async function getPropertyDeletion(
  deps: PropertyDeps,
  id: string,
): Promise<PropertyDeletion> {
  const refusal = await refusalFor(deps, id)
  if (refusal === 'not_found') {
    return notFound
  }
  if (refusal) {
    return { ok: true, ...refusal }
  }
  return {
    ok: true,
    allowed: true,
    ...(await deps.properties.deletionSummary(id)),
  }
}

/**
 * Deletes the flat with everything recorded for it, then its receipt files
 * (spec: "Deleting a flat"). The rows go in one guarded statement that
 * repeats the rule, so a change made after the check can't get through; a
 * failed file delete is logged and doesn't undo the deletion.
 */
export async function deleteProperty(
  deps: PropertyDeps,
  id: string,
): Promise<
  | { ok: true }
  | {
      ok: false
      reason:
        | 'property_not_found'
        | 'property_delete_other_owners'
        | 'sharing_owner_only'
    }
> {
  const refuse = async () => {
    const refusal = await refusalFor(deps, id)
    if (refusal === 'not_found' || refusal === undefined) {
      return notFound
    }
    deps.log.warn('property.delete_refused', {
      propertyId: id,
      reason: refusal.reason,
    })
    return { ok: false, reason: refusal.reason } as const
  }
  if (await refusalFor(deps, id)) {
    return refuse()
  }
  const keys = await deps.properties.receiptKeys(id)
  if (!(await deps.properties.deleteGuarded(deps.userId, id))) {
    return refuse()
  }
  await deleteStoredFiles(
    deps.storage,
    deps.log,
    keys,
    'property.receipt_delete_failed',
  )
  deps.log.info('property.deleted', { propertyId: id })
  return { ok: true }
}
