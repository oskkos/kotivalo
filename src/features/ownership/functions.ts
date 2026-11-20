// Server functions for flat ownership, called by the Ownership and sharing
// page. The logic is in ownership.server.ts; these validate the input with
// the shared schemas, check the session and wire in the request context.
import { createServerFn } from '@tanstack/react-start'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { getRequestContext } from '#/server/platform/context.server'
import { ownershipRepository } from './ownership.repository.server'
import {
  changeOwnership as change,
  correctFirstOwnershipDate as correct,
  getOwnership as get,
  undoOwnershipChange as undo,
  type OwnershipDeps,
} from './ownership.server'
import {
  changeOwnershipInput,
  correctFirstDateInput,
  propertyRefInput,
} from './schemas'

/**
 * The signed-in user's dependencies. Pages are protected by the signed-in
 * layout, endpoints are not: without a session this throws.
 */
async function ownershipDeps(): Promise<OwnershipDeps> {
  const context = getRequestContext()
  const session = await context.auth.getSession()
  if (!session) {
    throw new Error('Not signed in')
  }
  return {
    userId: session.user.id,
    ownership: ownershipRepository(context.db),
    sharing: sharingRepository(context.db),
    log: context.log,
    now: () => new Date(),
  }
}

export const getOwnership = createServerFn({ method: 'GET' })
  .validator(propertyRefInput)
  .handler(async ({ data }) => get(await ownershipDeps(), data.propertyId))

export const changeOwnership = createServerFn({ method: 'POST' })
  .validator(changeOwnershipInput)
  .handler(async ({ data }) =>
    change(await ownershipDeps(), data.propertyId, {
      from: data.from,
      reason: data.reason,
      split: data.shares.map((s) => ({ userId: s.userId, share: s.percent })),
      removeAccess: data.removeAccess,
    }),
  )

export const undoOwnershipChange = createServerFn({ method: 'POST' })
  .validator(propertyRefInput)
  .handler(async ({ data }) => undo(await ownershipDeps(), data.propertyId))

export const correctFirstOwnershipDate = createServerFn({ method: 'POST' })
  .validator(correctFirstDateInput)
  .handler(async ({ data }) =>
    correct(await ownershipDeps(), data.propertyId, data.date),
  )
