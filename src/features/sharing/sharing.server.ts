// Sharing flats: the logic behind the server functions in functions.ts, with
// its dependencies passed in so Workers tests can drive it (openspec:
// sharing).
import type { PropertyRepository } from '#/features/properties/property.repository.server'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import type { Locale } from '#/paraglide/runtime.js'
import type { PropertyRole } from '#/server/db/schema'
import { EmailError, type SendEmail } from '#/server/email/email'
import type { Logger } from '#/server/log/log'
import type { LimitResult, LimitRule } from '#/server/platform/limits.server'
import { INVITATION_VALID_DAYS, invitationEmail } from './invitation-email'
import type {
  PendingInvitation,
  SharingRepository,
} from './sharing.repository.server'

export interface SharingDeps {
  /** The signed-in user. */
  user: { id: string; email: string; name: string }
  sharing: SharingRepository
  properties: PropertyRepository
  sendEmail: SendEmail
  log: Logger
  now: () => Date
  consumeLimit: (key: string, rule: LimitRule) => Promise<LimitResult>
  /** The inviter's language, for an invitee without an account. */
  locale: Locale
  /** The app's origin, for the link in the invitation email. */
  appUrl: string
}

/** Spec: "Limiting invitations". */
export const INVITATION_LIMITS = {
  pendingPerProperty: 10,
  perUserPerDay: { windowSeconds: 24 * 60 * 60, max: 20 },
} as const

const DAY_MS = 24 * 60 * 60 * 1000

const EMAIL_REASONS = {
  quota: 'invitation_email_quota',
  rate_limited: 'email_busy',
  rejected: 'invitation_email_failed',
  unavailable: 'invitation_email_failed',
} as const satisfies Record<EmailError['failure'], AlertReason>

interface Failure<R extends FieldReason | AlertReason = AlertReason> {
  ok: false
  reason: R
}

const propertyNotFound = {
  ok: false,
  reason: 'property_not_found',
} as const satisfies Failure
const ownerOnly = {
  ok: false,
  reason: 'sharing_owner_only',
} as const satisfies Failure
const invitationNotFound = {
  ok: false,
  reason: 'invitation_not_found',
} as const satisfies Failure

export interface SharingView {
  property: { id: string; streetAddress: string }
  /** The signed-in user's role. */
  role: PropertyRole
  people: {
    userId: string
    name: string
    role: PropertyRole
    since: Date
    isYou: boolean
  }[]
  invitations: PendingInvitation[]
}

/** The flat's Sharing page: who has access and who is invited. */
export async function getSharing(
  deps: SharingDeps,
  propertyId: string,
): Promise<({ ok: true } & SharingView) | typeof propertyNotFound> {
  const property = await deps.properties.findForUser(deps.user.id, propertyId)
  const role = await deps.sharing.roleOf(deps.user.id, propertyId)
  if (!property || !role) {
    return propertyNotFound
  }
  const [people, invitations] = await Promise.all([
    deps.sharing.listPeople(propertyId),
    deps.sharing.listPending(propertyId, deps.now()),
  ])
  return {
    ok: true,
    property: { id: property.id, streetAddress: property.streetAddress },
    role,
    people: people.map((p) => ({ ...p, isYou: p.userId === deps.user.id })),
    invitations,
  }
}

/** `email` is already validated and normalised (schemas.ts). */
export async function inviteToProperty(
  deps: SharingDeps,
  propertyId: string,
  email: string,
): Promise<
  | { ok: true; id: string }
  | Failure<
      | AlertReason
      | Extract<
          FieldReason,
          'invitation_already_member' | 'invitation_already_pending'
        >
    >
> {
  const role = await deps.sharing.roleOf(deps.user.id, propertyId)
  if (!role) {
    return propertyNotFound
  }
  if (role !== 'owner') {
    return ownerOnly
  }
  const now = deps.now()
  // One query whether or not the address has an account (design decision 5).
  const recipient = await deps.sharing.findRecipient(propertyId, email)
  if (recipient.hasAccess) {
    return { ok: false, reason: 'invitation_already_member' }
  }
  if (await deps.sharing.isPending(propertyId, email, now)) {
    return { ok: false, reason: 'invitation_already_pending' }
  }
  if (
    (await deps.sharing.countPending(propertyId, now)) >=
    INVITATION_LIMITS.pendingPerProperty
  ) {
    deps.log.warn('sharing.invitation_limit_reached', { limit: 'property' })
    return { ok: false, reason: 'invitation_limit_reached' }
  }
  const daily = await deps.consumeLimit(
    `invite-user:${deps.user.id}`,
    INVITATION_LIMITS.perUserPerDay,
  )
  if (!daily.allowed) {
    deps.log.warn('sharing.invitation_limit_reached', { limit: 'daily' })
    return { ok: false, reason: 'invitation_daily_limit_reached' }
  }

  // Sent before it is saved, so a failed send leaves no invitation.
  const id = crypto.randomUUID()
  try {
    await deps.sendEmail(
      invitationEmail({
        to: email,
        inviterName: deps.user.name || deps.user.email,
        appUrl: deps.appUrl,
        locale: recipient.locale ?? deps.locale,
        invitationId: id,
      }),
    )
  } catch (error) {
    if (error instanceof EmailError) {
      deps.log.error(
        'sharing.invitation_email_failed',
        { failure: error.failure },
        error,
      )
      return { ok: false, reason: EMAIL_REASONS[error.failure] }
    }
    throw error
  }
  await deps.sharing.invite({
    id,
    propertyId,
    email,
    invitedBy: deps.user.id,
    now,
    expiresAt: new Date(now.getTime() + INVITATION_VALID_DAYS * DAY_MS),
  })
  deps.log.info('sharing.invitation_sent', { propertyId, invitationId: id })
  return { ok: true, id }
}

export async function cancelInvitation(
  deps: SharingDeps,
  invitationId: string,
): Promise<{ ok: true } | typeof invitationNotFound> {
  const propertyId = await deps.sharing.cancel(deps.user.id, invitationId)
  if (propertyId === undefined) {
    return invitationNotFound
  }
  deps.log.info('sharing.invitation_cancelled', { propertyId, invitationId })
  return { ok: true }
}
