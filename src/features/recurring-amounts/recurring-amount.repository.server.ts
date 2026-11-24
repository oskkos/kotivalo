// A flat's rent, charges, financing charges and financing charge treatment
// as periods (openspec: recurring-amounts). Writes run in one atomically() batch and carry their
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
  type SQL,
} from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { dayBefore, type IsoDate } from '#/lib/dates'
import {
  financingCharges,
  financingTreatments,
  properties,
  propertyAccess,
  recurringAmounts,
  type FinancingTreatment,
  type RecurringAmountKind,
} from '#/server/db/schema'
import { atomically, type Db } from '#/server/platform/db.server'
import type { Period } from './periods'

/** One of a flat's financing charges with its periods, oldest first. */
export interface FinancingCharge {
  id: string
  /** Null for the charge made when financing charges became several. */
  name: string | null
  periods: Period<number>[]
}

export interface RecurringAmounts {
  /** The rent's and the maintenance charge's periods, oldest first. */
  amounts: Record<'maintenance_charge', Period<number>[]>
  /** Ordered by their first period's start, then name. */
  financingCharges: FinancingCharge[]
  /** Oldest first. */
  treatments: Period<FinancingTreatment>[]
}

/**
 * A sequence of periods: the rent, the maintenance charge, or one financing
 * charge, named by `chargeId` (required for `financing_charge`).
 */
export interface Sequence {
  kind: RecurringAmountKind
  chargeId?: string
}

/** An undo's expectation: the latest and previous periods' starts as read. */
interface Undo {
  propertyId: string
  actorId: string
  latestStart: IsoDate
  previousStart: IsoDate | null
}

/** A write's expectation: the latest period's start as read, or none. */
export interface Expected {
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

  /**
   * The financing charge is the flat's, so a new period can't join another
   * flat's charge. Updates need no check: they match the flat's own rows.
   */
  const chargeOfFlat = (chargeId: string, propertyId: string) =>
    exists(
      db
        .select({ one: sql`1` })
        .from(financingCharges)
        .where(
          and(
            eq(financingCharges.id, chargeId),
            eq(financingCharges.propertyId, propertyId),
          ),
        ),
    )

  const amountScope = (propertyId: string, sequence: Sequence) => {
    if (sequence.kind !== 'financing_charge') {
      return and(
        eq(recurringAmounts.propertyId, propertyId),
        eq(recurringAmounts.kind, sequence.kind),
      )
    }
    if (sequence.chargeId === undefined) {
      throw new Error('A financing charge period needs its charge')
    }
    return and(
      eq(recurringAmounts.propertyId, propertyId),
      eq(recurringAmounts.kind, 'financing_charge'),
      eq(recurringAmounts.financingChargeId, sequence.chargeId),
    )
  }

  /**
   * The statements that set an amount from `from`: on the latest period's
   * start they correct that period, otherwise they close the latest period
   * the day before and add a new one. `onlyIf` joins every statement's
   * condition, so another write in the same batch can gate them. The last
   * statement returns a row when it applied.
   */
  function amountStatements(
    write: Expected & Sequence & { amount: number },
    onlyIf?: SQL,
  ): [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] {
    const { propertyId, actorId, kind, amount, from, latestStart } = write
    const scope = amountScope(propertyId, write)
    if (latestStart === from) {
      return [
        db
          .update(recurringAmounts)
          .set({ amount })
          .where(
            and(
              scope,
              eq(recurringAmounts.validFrom, from),
              isNull(recurringAmounts.validTo),
              isOwner(actorId, propertyId),
              onlyIf,
            ),
          )
          .returning({ id: recurringAmounts.id }),
      ]
    }
    const id = crypto.randomUUID()
    // The latest period is closed by this write (or there was none), and
    // nothing of this kind starts on or after `from`.
    const ready = and(
      eq(properties.id, propertyId),
      isOwner(actorId, propertyId),
      write.chargeId === undefined
        ? undefined
        : chargeOfFlat(write.chargeId, propertyId),
      onlyIf,
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
            financingChargeId: sql<string | null>`${write.chargeId ?? null}`.as(
              'financing_charge_id',
            ),
            amount: sql<number>`${amount}`.as('amount'),
            validFrom: sql<string>`${from}`.as('valid_from'),
            validTo: sql<null>`null`.as('valid_to'),
          })
          .from(properties)
          .where(ready),
      )
      .returning({ id: recurringAmounts.id })
    if (latestStart === null) {
      return [insert]
    }
    return [
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
            onlyIf,
          ),
        ),
      insert,
    ]
  }

  return {
    async forProperty(propertyId: string): Promise<RecurringAmounts> {
      const [amountRows, chargeRows, treatmentRows] = await Promise.all([
        db
          .select()
          .from(recurringAmounts)
          .where(eq(recurringAmounts.propertyId, propertyId))
          .orderBy(asc(recurringAmounts.validFrom)),
        db
          .select()
          .from(financingCharges)
          .where(eq(financingCharges.propertyId, propertyId)),
        db
          .select()
          .from(financingTreatments)
          .where(eq(financingTreatments.propertyId, propertyId))
          .orderBy(asc(financingTreatments.validFrom)),
      ])
      const period = (row: (typeof amountRows)[number]) => ({
        validFrom: row.validFrom,
        validTo: row.validTo,
        value: row.amount,
      })
      const charges: FinancingCharge[] = chargeRows
        .map((row) => ({
          id: row.id,
          name: row.name,
          periods: amountRows
            .filter((amount) => amount.financingChargeId === row.id)
            .map(period),
        }))
        .sort(
          (a, b) =>
            (a.periods[0]?.validFrom ?? '').localeCompare(
              b.periods[0]?.validFrom ?? '',
            ) || (a.name ?? '').localeCompare(b.name ?? '', 'fi'),
        )
      const of = (kind: RecurringAmountKind) =>
        amountRows.filter((row) => row.kind === kind).map(period)
      const amounts = {
        maintenance_charge: of('maintenance_charge'),
      }
      return {
        amounts,
        financingCharges: charges,
        treatments: treatmentRows.map((row) => ({
          validFrom: row.validFrom,
          validTo: row.validTo,
          value: row.treatment,
        })),
      }
    },

    amountStatements,

    /**
     * Sets an amount from `from` (amountStatements). Returns whether it
     * applied.
     */
    async setAmount(
      write: Expected & Sequence & { amount: number },
    ): Promise<boolean> {
      const results = await atomically(db, amountStatements(write))
      const last = results.at(-1) as unknown[]
      return last.length > 0
    },

    /**
     * Deletes the latest period and makes the previous one current again;
     * with no previous period (`previousStart` null) the amount is no longer
     * set, and a financing charge is removed with its last period.
     * `latestStart` and `previousStart` are the periods the caller read.
     * Returns whether it applied.
     */
    async undoLatestAmount(undo: Undo & Sequence): Promise<boolean> {
      const { propertyId, latestStart, previousStart } = undo
      const scope = amountScope(propertyId, undo)
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
        const chargeId = undo.chargeId
        const [removed] =
          chargeId === undefined
            ? await atomically(db, [remove])
            : await atomically(db, [
                remove,
                // The charge goes with its last period, only once none is
                // left, so another write's new period keeps it.
                db.delete(financingCharges).where(
                  and(
                    eq(financingCharges.id, chargeId),
                    eq(financingCharges.propertyId, propertyId),
                    isOwner(undo.actorId, propertyId),
                    notExists(
                      db
                        .select({ one: sql`1` })
                        .from(recurringAmounts)
                        .where(
                          eq(recurringAmounts.financingChargeId, chargeId),
                        ),
                    ),
                  ),
                ),
              ])
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

    /**
     * Adds a financing charge with its first period, both or neither: the
     * period's statements require the charge the first statement adds.
     * Returns whether it applied.
     */
    async addFinancingCharge(add: {
      propertyId: string
      actorId: string
      chargeId: string
      name: string
      amount: number
      from: IsoDate
    }): Promise<boolean> {
      const { propertyId, actorId, chargeId, name, amount, from } = add
      const results = await atomically(db, [
        db.insert(financingCharges).select(
          db
            .select({
              id: sql<string>`${chargeId}`.as('id'),
              propertyId: properties.id,
              name: sql<string>`${name}`.as('name'),
            })
            .from(properties)
            .where(
              and(eq(properties.id, propertyId), isOwner(actorId, propertyId)),
            ),
        ),
        ...amountStatements({
          propertyId,
          actorId,
          kind: 'financing_charge',
          chargeId,
          amount,
          from,
          latestStart: null,
        }),
      ])
      const last = results.at(-1) as unknown[]
      return last.length > 0
    },

    /** Renames a financing charge of the flat. Returns whether it applied. */
    async renameFinancingCharge(rename: {
      propertyId: string
      actorId: string
      chargeId: string
      name: string
    }): Promise<boolean> {
      const { propertyId, actorId, chargeId, name } = rename
      const [updated] = await atomically(db, [
        db
          .update(financingCharges)
          .set({ name })
          .where(
            and(
              eq(financingCharges.id, chargeId),
              eq(financingCharges.propertyId, propertyId),
              isOwner(actorId, propertyId),
            ),
          )
          .returning({ id: financingCharges.id }),
      ])
      return updated.length > 0
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
