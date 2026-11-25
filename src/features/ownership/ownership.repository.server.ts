// A flat's ownership periods and the roles that follow them (openspec:
// ownership). Writes run in one atomically() batch and carry their checks
// in the statements: the actor must be an owner, and a change applies only
// to the period it was validated against, so two changes at once can't
// leave overlapping periods.
import {
  and,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  lt,
  notExists,
  notInArray,
  sql,
  type SQL,
} from 'drizzle-orm'
import { dayBefore, type IsoDate } from '#/lib/dates'
import {
  ownershipPeriods,
  properties,
  propertyAccess,
  user,
  type OwnershipReason,
} from '#/server/db/schema'
import { atomically, type Db } from '#/server/platform/db.server'
import { groupPeriods, type Period, type Share } from './periods'

/** An owner's current share of a flat, with their name, for flat cards. */
export interface CurrentShare extends Share {
  propertyId: string
  name: string
}

export interface OwnershipHistory {
  /** Newest first. */
  periods: Period[]
  /** Everyone in the history, also people who no longer have access. */
  names: Record<string, string>
}

export function ownershipRepository(db: Db) {
  /** The actor owns the flat: the check inside each write. */
  const isOwner = (actorId: string, propertyId: string) =>
    exists(
      db
        .select({ one: sql`1` })
        .from(propertyAccess)
        .where(
          and(
            eq(propertyAccess.propertyId, propertyId),
            eq(propertyAccess.userId, actorId),
            eq(propertyAccess.role, 'owner'),
          ),
        ),
    )

  /** Rows of the flat starting on a date, other than `except`. */
  const startingOn = (propertyId: string, date: IsoDate, except: string[]) =>
    db
      .select({ one: sql`1` })
      .from(ownershipPeriods)
      .where(
        and(
          eq(ownershipPeriods.propertyId, propertyId),
          gte(ownershipPeriods.validFrom, date),
          except.length > 0
            ? notInArray(ownershipPeriods.id, except)
            : undefined,
        ),
      )

  /** Sets `owner` for `owners` and `member` for everyone else with access. */
  const setRoles = (propertyId: string, owners: string[], when: SQL) => [
    db
      .update(propertyAccess)
      .set({ role: 'owner' })
      .where(
        and(
          eq(propertyAccess.propertyId, propertyId),
          inArray(propertyAccess.userId, owners),
          when,
        ),
      ),
    db
      .update(propertyAccess)
      .set({ role: 'member' })
      .where(
        and(
          eq(propertyAccess.propertyId, propertyId),
          notInArray(propertyAccess.userId, owners),
          when,
        ),
      ),
  ]

  return {
    async history(propertyId: string): Promise<OwnershipHistory> {
      const rows = await db
        .select({
          userId: ownershipPeriods.userId,
          name: user.name,
          share: ownershipPeriods.share,
          validFrom: ownershipPeriods.validFrom,
          validTo: ownershipPeriods.validTo,
          reason: ownershipPeriods.reason,
        })
        .from(ownershipPeriods)
        .innerJoin(user, eq(user.id, ownershipPeriods.userId))
        .where(eq(ownershipPeriods.propertyId, propertyId))
      return {
        periods: groupPeriods(rows),
        names: Object.fromEntries(rows.map((r) => [r.userId, r.name])),
      }
    },

    /**
     * The ownership periods of the flats by flat id, newest first, with no
     * access check: the caller passes the ids of flats the user can see. A
     * flat without periods has no entry.
     */
    async rowsFor(
      propertyIds: string[],
    ): Promise<Partial<Record<string, Period[]>>> {
      if (propertyIds.length === 0) {
        return {}
      }
      const rows = await db
        .select({
          propertyId: ownershipPeriods.propertyId,
          userId: ownershipPeriods.userId,
          share: ownershipPeriods.share,
          validFrom: ownershipPeriods.validFrom,
          validTo: ownershipPeriods.validTo,
          reason: ownershipPeriods.reason,
        })
        .from(ownershipPeriods)
        .where(inArray(ownershipPeriods.propertyId, propertyIds))
      const byFlat: Partial<Record<string, typeof rows>> = {}
      for (const row of rows) {
        ;(byFlat[row.propertyId] ??= []).push(row)
      }
      return Object.fromEntries(
        Object.entries(byFlat).map(([propertyId, flatRows]) => [
          propertyId,
          groupPeriods(flatRows ?? []),
        ]),
      )
    },

    /** Current shares of every flat the user has access to. */
    currentForUser(userId: string): Promise<CurrentShare[]> {
      return db
        .select({
          propertyId: ownershipPeriods.propertyId,
          userId: ownershipPeriods.userId,
          name: user.name,
          share: ownershipPeriods.share,
        })
        .from(ownershipPeriods)
        .innerJoin(user, eq(user.id, ownershipPeriods.userId))
        .where(
          and(
            isNull(ownershipPeriods.validTo),
            inArray(
              ownershipPeriods.propertyId,
              db
                .select({ id: propertyAccess.propertyId })
                .from(propertyAccess)
                .where(eq(propertyAccess.userId, userId)),
            ),
          ),
        )
    },

    /**
     * Records a new split from `from`: ends the current period the day
     * before, adds the new one, sets the roles from it and removes the
     * access of `removeAccess` (people going to 0 %). On the current
     * period's start it replaces that period's split instead (design
     * decision 7). Returns whether it applied: not when the actor isn't an
     * owner or the current period no longer starts at `currentStart`.
     */
    async change(change: {
      propertyId: string
      actorId: string
      currentStart: IsoDate
      from: IsoDate
      reason: OwnershipReason
      split: Share[]
      removeAccess: string[]
    }): Promise<boolean> {
      const { propertyId, from } = change
      const owners = change.split.filter((s) => s.share > 0)
      const ids = owners.map(() => crypto.randomUUID())
      // The current period was closed by this change, and no other change
      // has started on or after `from`.
      const closed = and(
        exists(
          db
            .select({ one: sql`1` })
            .from(ownershipPeriods)
            .where(
              and(
                eq(ownershipPeriods.propertyId, propertyId),
                eq(ownershipPeriods.validFrom, change.currentStart),
                eq(ownershipPeriods.validTo, dayBefore(from)),
              ),
            ),
        ),
        notExists(startingOn(propertyId, from, ids)),
        eq(properties.id, propertyId),
      )
      const correcting = from === change.currentStart
      // A correction deleted the current rows, and nothing else starts on
      // or after `from`.
      const corrected = and(
        notExists(startingOn(propertyId, from, ids)),
        eq(properties.id, propertyId),
      )
      const applied = exists(
        db
          .select({ one: sql`1` })
          .from(ownershipPeriods)
          .where(inArray(ownershipPeriods.id, ids)),
      )
      const current = and(
        eq(ownershipPeriods.propertyId, propertyId),
        isNull(ownershipPeriods.validTo),
        eq(ownershipPeriods.validFrom, change.currentStart),
        isOwner(change.actorId, propertyId),
      )
      const results = await atomically(db, [
        correcting
          ? db
              .delete(ownershipPeriods)
              .where(current)
              .returning({ id: ownershipPeriods.id })
          : db
              .update(ownershipPeriods)
              .set({ validTo: dayBefore(from) })
              .where(and(current, lt(ownershipPeriods.validFrom, from)))
              .returning({ id: ownershipPeriods.id }),
        ...owners.map((owner, i) => {
          const id = ids[i] ?? ''
          return db.insert(ownershipPeriods).select(
            db
              .select({
                id: sql<string>`${id}`.as('id'),
                propertyId: properties.id,
                userId: sql<string>`${owner.userId}`.as('user_id'),
                share: sql<number>`${owner.share}`.as('share'),
                validFrom: sql<string>`${from}`.as('valid_from'),
                validTo: sql<null>`null`.as('valid_to'),
                reason: sql<OwnershipReason>`${change.reason}`.as('reason'),
              })
              .from(properties)
              .where(correcting ? corrected : closed),
          )
        }),
        ...setRoles(
          propertyId,
          owners.map((o) => o.userId),
          applied,
        ),
        db.delete(propertyAccess).where(
          and(
            eq(propertyAccess.propertyId, propertyId),
            inArray(propertyAccess.userId, change.removeAccess),
            notInArray(
              propertyAccess.userId,
              owners.map((o) => o.userId),
            ),
            applied,
          ),
        ),
      ])
      return results[0].length > 0
    },

    /**
     * Deletes the latest period and makes the previous one current again,
     * with its roles. `latest` and `previous` are the periods the caller
     * read. Returns whether it applied.
     */
    async undoLatest(undo: {
      propertyId: string
      actorId: string
      latest: Period
      previous: Period
    }): Promise<boolean> {
      const { propertyId, latest, previous } = undo
      const gone = notExists(
        db
          .select({ one: sql`1` })
          .from(ownershipPeriods)
          .where(
            and(
              eq(ownershipPeriods.propertyId, propertyId),
              eq(ownershipPeriods.validFrom, latest.validFrom),
            ),
          ),
      )
      const results = await atomically(db, [
        db
          .delete(ownershipPeriods)
          .where(
            and(
              eq(ownershipPeriods.propertyId, propertyId),
              eq(ownershipPeriods.validFrom, latest.validFrom),
              isNull(ownershipPeriods.validTo),
              isOwner(undo.actorId, propertyId),
            ),
          )
          .returning({ id: ownershipPeriods.id }),
        db
          .update(ownershipPeriods)
          .set({ validTo: null })
          .where(
            and(
              eq(ownershipPeriods.propertyId, propertyId),
              eq(ownershipPeriods.validFrom, previous.validFrom),
              eq(ownershipPeriods.validTo, dayBefore(latest.validFrom)),
              gone,
            ),
          ),
        ...setRoles(
          propertyId,
          previous.shares.map((s) => s.userId),
          // Only when this undo deleted the latest period.
          gone,
        ),
      ])
      return results[0].length > 0
    },

    /** Moves the first period's start. Returns whether it applied. */
    async correctFirstDate(correction: {
      propertyId: string
      actorId: string
      firstStart: IsoDate
      date: IsoDate
    }): Promise<boolean> {
      const changed = await db
        .update(ownershipPeriods)
        .set({ validFrom: correction.date })
        .where(
          and(
            eq(ownershipPeriods.propertyId, correction.propertyId),
            eq(ownershipPeriods.validFrom, correction.firstStart),
            isOwner(correction.actorId, correction.propertyId),
            notExists(
              db
                .select({ one: sql`1` })
                .from(ownershipPeriods)
                .where(
                  and(
                    eq(ownershipPeriods.propertyId, correction.propertyId),
                    lt(ownershipPeriods.validFrom, correction.firstStart),
                  ),
                ),
            ),
          ),
        )
        .returning({ id: ownershipPeriods.id })
      return changed.length > 0
    },
  }
}

export type OwnershipRepository = ReturnType<typeof ownershipRepository>
