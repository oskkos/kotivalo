// Who can reach a flat and who is invited to it (openspec: sharing). Checks
// of the acting user's role are inside the statements that change data, as
// in the property repository, so there is no read-then-write gap.
import { and, asc, desc, eq, gt, inArray, lte, sql } from 'drizzle-orm'
import { isLocale, type Locale } from '#/paraglide/runtime.js'
import {
  properties,
  propertyAccess,
  propertyInvitations,
  user,
  type PropertyRole,
} from '#/server/db/schema'
import { atomically, type Db } from '#/server/platform/db.server'

export interface Person {
  userId: string
  name: string
  role: PropertyRole
  since: Date
}

export interface PendingInvitation {
  id: string
  email: string
  createdAt: Date
  expiresAt: Date
}

/** An invitation as its invitee sees it. */
export interface ReceivedInvitation {
  id: string
  propertyId: string
  streetAddress: string
  city: string
  inviterName: string
  expiresAt: Date
}

/** What an address means to a flat: an account's language and access. */
export interface Recipient {
  /** The language of the account with the address; null without one. */
  locale: Locale | null
  hasAccess: boolean
}

export function sharingRepository(db: Db) {
  /** The flats the user owns, as a subquery. */
  const owned = (userId: string) =>
    db
      .select({ id: propertyAccess.propertyId })
      .from(propertyAccess)
      .where(
        and(
          eq(propertyAccess.userId, userId),
          eq(propertyAccess.role, 'owner'),
        ),
      )

  /** An invitation that `email` may still accept. */
  const acceptable = (invitationId: string, email: string, now: Date) =>
    and(
      eq(propertyInvitations.id, invitationId),
      eq(propertyInvitations.email, email),
      gt(propertyInvitations.expiresAt, now),
    )

  return {
    async roleOf(
      userId: string,
      propertyId: string,
    ): Promise<PropertyRole | undefined> {
      const row = await db
        .select({ role: propertyAccess.role })
        .from(propertyAccess)
        .where(
          and(
            eq(propertyAccess.userId, userId),
            eq(propertyAccess.propertyId, propertyId),
          ),
        )
        .get()
      return row?.role
    },

    /** The users with access: the owner first, then in the order they joined. */
    async listPeople(propertyId: string): Promise<Person[]> {
      const rows = await db
        .select({
          userId: propertyAccess.userId,
          name: user.name,
          role: propertyAccess.role,
          since: propertyAccess.createdAt,
        })
        .from(propertyAccess)
        .innerJoin(user, eq(user.id, propertyAccess.userId))
        .where(eq(propertyAccess.propertyId, propertyId))
        .orderBy(asc(propertyAccess.createdAt))
      return rows.sort(
        (a, b) => Number(b.role === 'owner') - Number(a.role === 'owner'),
      )
    },

    /** Newest first. Expired invitations are left out. */
    listPending(propertyId: string, now: Date): Promise<PendingInvitation[]> {
      return db
        .select({
          id: propertyInvitations.id,
          email: propertyInvitations.email,
          createdAt: propertyInvitations.createdAt,
          expiresAt: propertyInvitations.expiresAt,
        })
        .from(propertyInvitations)
        .where(
          and(
            eq(propertyInvitations.propertyId, propertyId),
            gt(propertyInvitations.expiresAt, now),
          ),
        )
        .orderBy(desc(propertyInvitations.createdAt))
    },

    /**
     * The account with `email`, if any, and whether it has access to the
     * flat: one query, so an address with an account takes the same path as
     * one without.
     */
    async findRecipient(propertyId: string, email: string): Promise<Recipient> {
      const row = await db
        .select({ locale: user.locale, access: propertyAccess.userId })
        .from(user)
        .leftJoin(
          propertyAccess,
          and(
            eq(propertyAccess.userId, user.id),
            eq(propertyAccess.propertyId, propertyId),
          ),
        )
        .where(eq(user.email, email))
        .get()
      return {
        locale: row !== undefined && isLocale(row.locale) ? row.locale : null,
        hasAccess: row?.access != null,
      }
    },

    async isPending(
      propertyId: string,
      email: string,
      now: Date,
    ): Promise<boolean> {
      const count = await db.$count(
        propertyInvitations,
        and(
          eq(propertyInvitations.propertyId, propertyId),
          eq(propertyInvitations.email, email),
          gt(propertyInvitations.expiresAt, now),
        ),
      )
      return count > 0
    },

    countPending(propertyId: string, now: Date): Promise<number> {
      return db.$count(
        propertyInvitations,
        and(
          eq(propertyInvitations.propertyId, propertyId),
          gt(propertyInvitations.expiresAt, now),
        ),
      )
    },

    /**
     * Saves an invitation, replacing an expired one for the same address.
     * The caller has checked the role and that none is pending; the unique
     * key refuses a duplicate that slipped past.
     */
    async invite(invitation: {
      /** Chosen by the caller when the email needs it first. */
      id?: string
      propertyId: string
      email: string
      invitedBy: string
      now: Date
      expiresAt: Date
    }): Promise<{ id: string } | undefined> {
      const id = invitation.id ?? crypto.randomUUID()
      const [, inserted] = await atomically(db, [
        db
          .delete(propertyInvitations)
          .where(
            and(
              eq(propertyInvitations.propertyId, invitation.propertyId),
              eq(propertyInvitations.email, invitation.email),
              lte(propertyInvitations.expiresAt, invitation.now),
            ),
          ),
        db
          .insert(propertyInvitations)
          .values({
            id,
            propertyId: invitation.propertyId,
            email: invitation.email,
            invitedBy: invitation.invitedBy,
            createdAt: invitation.now,
            expiresAt: invitation.expiresAt,
          })
          .onConflictDoNothing()
          .returning({ id: propertyInvitations.id }),
      ])
      return inserted.length > 0 ? { id } : undefined
    },

    /**
     * Deletes an invitation to a flat the user owns. Returns its flat's id,
     * or undefined when there was no such invitation or the user isn't the
     * owner.
     */
    async cancel(
      ownerId: string,
      invitationId: string,
    ): Promise<string | undefined> {
      const deleted = await db
        .delete(propertyInvitations)
        .where(
          and(
            eq(propertyInvitations.id, invitationId),
            inArray(propertyInvitations.propertyId, owned(ownerId)),
          ),
        )
        .returning({ propertyId: propertyInvitations.propertyId })
      return deleted.at(0)?.propertyId
    },

    /** The invitations `email` may accept, newest first. */
    listForInvitee(email: string, now: Date): Promise<ReceivedInvitation[]> {
      return db
        .select({
          id: propertyInvitations.id,
          propertyId: propertyInvitations.propertyId,
          streetAddress: properties.streetAddress,
          city: properties.city,
          inviterName: user.name,
          expiresAt: propertyInvitations.expiresAt,
        })
        .from(propertyInvitations)
        .innerJoin(
          properties,
          eq(properties.id, propertyInvitations.propertyId),
        )
        .innerJoin(user, eq(user.id, propertyInvitations.invitedBy))
        .where(
          and(
            eq(propertyInvitations.email, email),
            gt(propertyInvitations.expiresAt, now),
          ),
        )
        .orderBy(desc(propertyInvitations.createdAt))
    },

    /**
     * Turns an invitation into `member` access for the user signed in with
     * `email`, and deletes it. Both statements match only an unexpired
     * invitation for that address, so anything else changes nothing.
     * Returns the flat's id, or undefined.
     */
    async accept(
      userId: string,
      email: string,
      invitationId: string,
      now: Date,
    ): Promise<string | undefined> {
      const [inserted] = await atomically(db, [
        db
          .insert(propertyAccess)
          .select(
            db
              .select({
                propertyId: propertyInvitations.propertyId,
                userId: sql<string>`${userId}`.as('user_id'),
                role: sql<PropertyRole>`'member'`.as('role'),
                createdAt: sql<Date>`${now.getTime()}`.as('created_at'),
              })
              .from(propertyInvitations)
              .where(acceptable(invitationId, email, now)),
          )
          .onConflictDoNothing()
          .returning({ propertyId: propertyAccess.propertyId }),
        db
          .delete(propertyInvitations)
          .where(acceptable(invitationId, email, now)),
      ])
      return inserted.at(0)?.propertyId
    },

    /** Deletes an invitation for `email`. Returns whether there was one. */
    async decline(email: string, invitationId: string): Promise<boolean> {
      const deleted = await db
        .delete(propertyInvitations)
        .where(
          and(
            eq(propertyInvitations.id, invitationId),
            eq(propertyInvitations.email, email),
          ),
        )
        .returning({ id: propertyInvitations.id })
      return deleted.length > 0
    },

    /**
     * Removes a member's access to a flat the acting user owns. Never
     * removes an owner. Returns whether access was removed.
     */
    async removeMember(
      ownerId: string,
      propertyId: string,
      memberId: string,
    ): Promise<boolean> {
      const deleted = await db
        .delete(propertyAccess)
        .where(
          and(
            eq(propertyAccess.propertyId, propertyId),
            eq(propertyAccess.userId, memberId),
            eq(propertyAccess.role, 'member'),
            inArray(propertyAccess.propertyId, owned(ownerId)),
          ),
        )
        .returning({ userId: propertyAccess.userId })
      return deleted.length > 0
    },

    /** Removes the user's own `member` access. Returns whether it did. */
    async leave(memberId: string, propertyId: string): Promise<boolean> {
      const deleted = await db
        .delete(propertyAccess)
        .where(
          and(
            eq(propertyAccess.propertyId, propertyId),
            eq(propertyAccess.userId, memberId),
            eq(propertyAccess.role, 'member'),
          ),
        )
        .returning({ userId: propertyAccess.userId })
      return deleted.length > 0
    },
  }
}

export type SharingRepository = ReturnType<typeof sharingRepository>
