// Server functions for sharing flats, called by the Sharing page and the
// flats list. The logic is in sharing.server.ts; these validate the input
// with the shared schemas, check the session and wire in the request context.
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { getLocale } from '#/paraglide/runtime.js'
import { getRequestContext } from '#/server/platform/context.server'
import { consumeLimit } from '#/server/platform/limits.server'
import { invitationIdInput, inviteInput, propertyRefInput } from './schemas'
import { sharingRepository } from './sharing.repository.server'
import {
  cancelInvitation as cancel,
  getSharing as get,
  inviteToProperty as invite,
  type SharingDeps,
} from './sharing.server'

/**
 * The signed-in user's dependencies. Pages are protected by the signed-in
 * layout, endpoints are not: without a session this throws.
 */
async function sharingDeps(): Promise<SharingDeps> {
  const context = getRequestContext()
  const session = await context.auth.getSession()
  if (!session) {
    throw new Error('Not signed in')
  }
  const { id, email, name } = session.user
  return {
    user: { id, email, name },
    sharing: sharingRepository(context.db),
    properties: propertyRepository(context.db),
    sendEmail: context.sendEmail,
    log: context.log,
    now: () => new Date(),
    consumeLimit: (key, rule) => consumeLimit(context.db, key, rule),
    locale: getLocale(),
    appUrl: new URL(getRequest().url).origin,
  }
}

export const getSharing = createServerFn({ method: 'GET' })
  .validator(propertyRefInput)
  .handler(async ({ data }) => get(await sharingDeps(), data.propertyId))

export const inviteToProperty = createServerFn({ method: 'POST' })
  .validator(inviteInput)
  .handler(async ({ data }) =>
    invite(await sharingDeps(), data.propertyId, data.email),
  )

export const cancelInvitation = createServerFn({ method: 'POST' })
  .validator(invitationIdInput)
  .handler(async ({ data }) => cancel(await sharingDeps(), data.invitationId))
