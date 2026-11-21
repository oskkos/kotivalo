// A flat's rent, charges and financing charge treatment as periods (openspec:
// recurring-amounts). Writes run in one atomically() batch and carry their
// checks in the statements: the actor must be an owner, and a write applies
// only to the latest period it was validated against, so two writes at once
// can't leave overlapping periods.
import {
  and,
  asc,
  eq,
  exists,
  gte,
  isNull,
  lt,
  notExists,
  sql,
} from 'drizzle-orm'
import { dayBefore, type IsoDate } from '#/lib/dates'
import {
  financingTreatments,
  properties,
  propertyAccess,
  recurringAmounts,
  RECURRING_AMOUNT_KINDS,
  type FinancingTreatment,
  type RecurringAmountKind,
} from '#/server/db/schema'
import { atomically, type Db } from '#/server/platform/db.server'
import type { Period } from './periods'

export interface RecurringAmounts {
  /** Per kind, oldest first. */
  amounts: Record<RecurringAmountKind, Period<number>[]>
  /** Oldest first. */
  treatments: Period<FinancingTreatment>[]
}

/** An undo's expectation: the latest and previous periods' starts as read. */
interface Undo {
  propertyId: string
  actorId: string
  latestStart: IsoDate
  previousStart: IsoDate | null
}

/** A write's expectation: the latest period's start as read, or none. */
interface Expected {
  propertyId: string
  actorId: string
  latestStart: IsoDate | null
  from: IsoDate
}

export function recurringAmountRepository(db: Db) {
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

  const amountScope = (propertyId: string, kind: RecurringAmountKind) =>
    and(
      eq(recurringAmounts.propertyId, propertyId),
      eq(recurringAmounts.kind, kind),
    )

  return {
    async forProperty(propertyId: string): Promise<RecurringAmounts> {
      const [amountRows, treatmentRows] = await Promise.all([
        db
          .select()
          .from(recurringAmounts)
          .where(eq(recurringAmounts.propertyId, propertyId))
          .orderBy(asc(recurringAmounts.validFrom)),
        db
          .select()
          .from(financingTreatments)
          .where(eq(financingTreatments.propertyId, propertyId))
          .orderBy(asc(financingTreatments.validFrom)),
      ])
      const amounts = Object.fromEntries(
        RECURRING_AMOUNT_KINDS.map((kind) => [
          kind,
          amountRows
            .filter((row) => row.kind === kind)
            .map((row) => ({
              validFrom: row.validFrom,
              validTo: row.validTo,
              value: row.amount,
            })),
        ]),
      ) as RecurringAmounts['amounts']
      return {
        amounts,
        treatments: treatmentRows.map((row) => ({
          validFrom: row.validFrom,
          validTo: row.validTo,
          value: row.treatment,
        })),
      }
    },

    /**
     * Sets an amount from `from`: on the latest period's start it corrects
     * that period, otherwise it closes the latest period the day before and
     * adds a new one. Returns whether it applied.
     */
    async setAmount(
      write: Expected & { kind: RecurringAmountKind; amount: number },
    ): Promise<boolean> {
      const { propertyId, actorId, kind, amount, from, latestStart } = write
      const scope = amountScope(propertyId, kind)
      if (latestStart === from) {
        const [updated] = await atomically(db, [
          db
            .update(recurringAmounts)
            .set({ amount })
            .where(
              and(
                scope,
                eq(recurringAmounts.validFrom, from),
                isNull(recurringAmounts.validTo),
                isOwner(actorId, propertyId),
              ),
            )
            .returning({ id: recurringAmounts.id }),
        ])
        return updated.length > 0
      }
      const id = crypto.randomUUID()
      // The latest period is closed by this write (or there was none), and
      // nothing of this kind starts on or after `from`.
      const ready = and(
        eq(properties.id, propertyId),
        isOwner(actorId, propertyId),
        notExists(
          db
            .select({ one: sql`1` })
            .from(recurringAmounts)
            .where(and(scope, gte(recurringAmounts.validFrom, from))),
        ),
        latestStart === null
          ? notExists(
              db
                .select({ one: sql`1` })
                .from(recurringAmounts)
                .where(scope),
            )
          : exists(
              db
                .select({ one: sql`1` })
                .from(recurringAmounts)
                .where(
                  and(
                    scope,
                    eq(recurringAmounts.validFrom, latestStart),
                    eq(recurringAmounts.validTo, dayBefore(from)),
                  ),
                ),
            ),
      )
      const insert = db
        .insert(recurringAmounts)
        .select(
          db
            .select({
              id: sql<string>`${id}`.as('id'),
              propertyId: properties.id,
              kind: sql<RecurringAmountKind>`${kind}`.as('kind'),
              amount: sql<number>`${amount}`.as('amount'),
              validFrom: sql<string>`${from}`.as('valid_from'),
              validTo: sql<null>`null`.as('valid_to'),
            })
            .from(properties)
            .where(ready),
        )
        .returning({ id: recurringAmounts.id })
      if (latestStart === null) {
        const [inserted] = await atomically(db, [insert])
        return inserted.length > 0
      }
      const [, inserted] = await atomically(db, [
        db
          .update(recurringAmounts)
          .set({ validTo: dayBefore(from) })
          .where(
            and(
              scope,
              eq(recurringAmounts.validFrom, latestStart),
              lt(recurringAmounts.validFrom, from),
              isNull(recurringAmounts.validTo),
              isOwner(actorId, propertyId),
            ),
          ),
        insert,
      ])
      return inserted.length > 0
    },

    /**
     * Deletes the latest period and makes the previous one current again;
     * with no previous period (`previousStart` null) the amount is no longer
     * set. `latestStart` and `previousStart` are the periods the caller read.
     * Returns whether it applied.
     */
    async undoLatestAmount(
      undo: Undo & { kind: RecurringAmountKind },
    ): Promise<boolean> {
      const { propertyId, kind, latestStart, previousStart } = undo
      const scope = amountScope(propertyId, kind)
      const remove = db
        .delete(recurringAmounts)
        .where(
          and(
            scope,
            eq(recurringAmounts.validFrom, latestStart),
            isNull(recurringAmounts.validTo),
            isOwner(undo.actorId, propertyId),
          ),
        )
        .returning({ id: recurringAmounts.id })
      if (previousStart === null) {
        const [removed] = await atomically(db, [remove])
        return removed.length > 0
      }
      const [removed] = await atomically(db, [
        remove,
        db
          .update(recurringAmounts)
          .set({ validTo: null })
          .where(
            and(
              scope,
              eq(recurringAmounts.validFrom, previousStart),
              eq(recurringAmounts.validTo, dayBefore(latestStart)),
              notExists(
                db
                  .select({ one: sql`1` })
                  .from(recurringAmounts)
                  .where(
                    and(scope, eq(recurringAmounts.validFrom, latestStart)),
                  ),
              ),
            ),
          ),
      ])
      return removed.length > 0
    },

    /** Sets the financing charge treatment from `from`, like setAmount. */
    async setTreatment(
      write: Expected & { treatment: FinancingTreatment },
    ): Promise<boolean> {
      const { propertyId, actorId, treatment, from, latestStart } = write
      const scope = eq(financingTreatments.propertyId, propertyId)
      if (latestStart === from) {
        const [updated] = await atomically(db, [
          db
            .update(financingTreatments)
            .set({ treatment })
            .where(
              and(
                scope,
                eq(financingTreatments.validFrom, from),
                isNull(financingTreatments.validTo),
                isOwner(actorId, propertyId),
              ),
            )
            .returning({ id: financingTreatments.id }),
        ])
        return updated.length > 0
      }
      const id = crypto.randomUUID()
      const ready = and(
        eq(properties.id, propertyId),
        isOwner(actorId, propertyId),
        notExists(
          db
            .select({ one: sql`1` })
            .from(financingTreatments)
            .where(and(scope, gte(financingTreatments.validFrom, from))),
        ),
        latestStart === null
          ? notExists(
              db
                .select({ one: sql`1` })
                .from(financingTreatments)
                .where(scope),
            )
          : exists(
              db
                .select({ one: sql`1` })
                .from(financingTreatments)
                .where(
                  and(
                    scope,
                    eq(financingTreatments.validFrom, latestStart),
                    eq(financingTreatments.validTo, dayBefore(from)),
                  ),
                ),
            ),
      )
      const insert = db
        .insert(financingTreatments)
        .select(
          db
            .select({
              id: sql<string>`${id}`.as('id'),
              propertyId: properties.id,
              treatment: sql<FinancingTreatment>`${treatment}`.as('treatment'),
              validFrom: sql<string>`${from}`.as('valid_from'),
              validTo: sql<null>`null`.as('valid_to'),
            })
            .from(properties)
            .where(ready),
        )
        .returning({ id: financingTreatments.id })
      if (latestStart === null) {
        const [inserted] = await atomically(db, [insert])
        return inserted.length > 0
      }
      const [, inserted] = await atomically(db, [
        db
          .update(financingTreatments)
          .set({ validTo: dayBefore(from) })
          .where(
            and(
              scope,
              eq(financingTreatments.validFrom, latestStart),
              lt(financingTreatments.validFrom, from),
              isNull(financingTreatments.validTo),
              isOwner(actorId, propertyId),
            ),
          ),
        insert,
      ])
      return inserted.length > 0
    },

    /** Undoes the latest treatment change, like undoLatestAmount. */
    async undoLatestTreatment(undo: Undo): Promise<boolean> {
      const { propertyId, latestStart, previousStart } = undo
      const scope = eq(financingTreatments.propertyId, propertyId)
      const remove = db
        .delete(financingTreatments)
        .where(
          and(
            scope,
            eq(financingTreatments.validFrom, latestStart),
            isNull(financingTreatments.validTo),
            isOwner(undo.actorId, propertyId),
          ),
        )
        .returning({ id: financingTreatments.id })
      if (previousStart === null) {
        const [removed] = await atomically(db, [remove])
        return removed.length > 0
      }
      const [removed] = await atomically(db, [
        remove,
        db
          .update(financingTreatments)
          .set({ validTo: null })
          .where(
            and(
              scope,
              eq(financingTreatments.validFrom, previousStart),
              eq(financingTreatments.validTo, dayBefore(latestStart)),
              notExists(
                db
                  .select({ one: sql`1` })
                  .from(financingTreatments)
                  .where(
                    and(scope, eq(financingTreatments.validFrom, latestStart)),
                  ),
              ),
            ),
          ),
      ])
      return removed.length > 0
    },
  }
}

export type RecurringAmountRepository = ReturnType<
  typeof recurringAmountRepository
>
