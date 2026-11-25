// The statements that change a sequence of period rows (a value with
// `valid_from` / `valid_to`, the latest one open): occupants, usage charge
// amounts and tenant fee amounts. Each statement carries the caller's owner
// check and the expected latest start inside it, so a role lost or a period
// changed between the read and the write applies nothing; the server checks
// the same rules first to give the reason. The older builders for
// recurring_amounts and tenancy_rents stay in their repositories.
import {
  and,
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
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import { dayBefore, type IsoDate } from '#/lib/dates'
import type { Db } from '#/server/platform/db.server'
import {
  tenancies,
  tenancyOccupants,
  tenantFeeAmounts,
  tenantFees,
  usageChargeAmounts,
  usageCharges,
} from './schema'

/** A period table and the parent row it belongs to. */
export interface PeriodTable {
  table: SQLiteTable
  /** The period rows' reference to the parent. */
  parentKey: SQLiteColumn
  validFrom: SQLiteColumn
  validTo: SQLiteColumn
  /** The period's value: persons or an amount in cents. */
  value: SQLiteColumn
  parent: SQLiteTable
  parentId: SQLiteColumn
  /** The property names of the table's columns, for the inserted row. */
  keys: { id: string; parent: string; value: string }
}

export const occupantsPeriods: PeriodTable = {
  table: tenancyOccupants,
  parentKey: tenancyOccupants.tenancyId,
  validFrom: tenancyOccupants.validFrom,
  validTo: tenancyOccupants.validTo,
  value: tenancyOccupants.persons,
  parent: tenancies,
  parentId: tenancies.id,
  keys: { id: 'id', parent: 'tenancyId', value: 'persons' },
}

export const usageChargePeriods: PeriodTable = {
  table: usageChargeAmounts,
  parentKey: usageChargeAmounts.usageChargeId,
  validFrom: usageChargeAmounts.validFrom,
  validTo: usageChargeAmounts.validTo,
  value: usageChargeAmounts.amount,
  parent: usageCharges,
  parentId: usageCharges.id,
  keys: { id: 'id', parent: 'usageChargeId', value: 'amount' },
}

export const tenantFeePeriods: PeriodTable = {
  table: tenantFeeAmounts,
  parentKey: tenantFeeAmounts.tenantFeeId,
  validFrom: tenantFeeAmounts.validFrom,
  validTo: tenantFeeAmounts.validTo,
  value: tenantFeeAmounts.amount,
  parent: tenantFees,
  parentId: tenantFees.id,
  keys: { id: 'id', parent: 'tenantFeeId', value: 'amount' },
}

/** What a write expects of the sequence it changes. */
export interface PeriodWrite {
  parentId: string
  value: number
  /** The new period's start. */
  from: IsoDate
  /** The latest period's start as read, or none for a first period. */
  latestStart: IsoDate | null
  /**
   * True when `from` is the latest period's start: the value of that
   * period is corrected, while it still starts there.
   */
  corrects?: boolean
  /** The caller's check that the actor may change the parent. */
  owned: SQL | undefined
  /** Another condition every statement carries. */
  onlyIf?: SQL
}

/** An undo's expectation: the latest and previous periods' starts. */
export interface PeriodUndo {
  parentId: string
  latestStart: IsoDate
  previousStart: IsoDate
  owned: SQL | undefined
}

const one = sql`1`

/**
 * Adds a period from `write.from`, closing the open one the day before, or
 * corrects the latest period's value. The last statement returns the row's
 * id exactly when the write applied.
 */
export function periodWriteStatements(
  db: Db,
  periods: PeriodTable,
  write: PeriodWrite,
): [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] {
  const { parentId, value, from, latestStart, owned, onlyIf } = write
  const scope = eq(periods.parentKey, parentId)
  if (write.corrects === true) {
    return [
      db
        .update(periods.table)
        .set({ [periods.keys.value]: value })
        .where(
          and(
            scope,
            eq(periods.validFrom, from),
            isNull(periods.validTo),
            owned,
            onlyIf,
          ),
        )
        .returning({ id: periods.parentKey }),
    ]
  }
  // The latest period is closed by this write (or there was none), and
  // nothing starts on or after `from`.
  const ready = and(
    eq(periods.parentId, parentId),
    owned,
    onlyIf,
    notExists(
      db
        .select({ one })
        .from(periods.table)
        .where(and(scope, gte(periods.validFrom, from))),
    ),
    latestStart === null
      ? notExists(db.select({ one }).from(periods.table).where(scope))
      : exists(
          db
            .select({ one })
            .from(periods.table)
            .where(
              and(
                scope,
                eq(periods.validFrom, latestStart),
                eq(periods.validTo, dayBefore(from)),
              ),
            ),
        ),
  )
  const insert = db
    .insert(periods.table)
    .select(
      db
        .select({
          [periods.keys.id]: sql<string>`${crypto.randomUUID()}`.as('id'),
          [periods.keys.parent]: periods.parentId,
          [periods.keys.value]: sql<number>`${value}`.as('value'),
          validFrom: sql<string>`${from}`.as('valid_from'),
          validTo: sql<null>`null`.as('valid_to'),
        })
        .from(periods.parent)
        .where(ready) as never,
    )
    .returning({ id: periods.parentKey })
  if (latestStart === null) {
    return [insert]
  }
  return [
    db
      .update(periods.table)
      .set({ validTo: dayBefore(from) })
      .where(
        and(
          scope,
          eq(periods.validFrom, latestStart),
          lt(periods.validFrom, from),
          isNull(periods.validTo),
          owned,
          onlyIf,
        ),
      ),
    insert,
  ]
}

/**
 * Deletes the latest period and reopens the previous one, while the latest
 * still starts on `undo.latestStart` and the previous one ends the day
 * before. The first statement returns a row exactly when the undo applied.
 */
export function periodUndoStatements(
  db: Db,
  periods: PeriodTable,
  undo: PeriodUndo,
): [BatchItem<'sqlite'>, BatchItem<'sqlite'>] {
  const { parentId, latestStart, previousStart, owned } = undo
  const scope = eq(periods.parentKey, parentId)
  const previous = and(
    scope,
    eq(periods.validFrom, previousStart),
    eq(periods.validTo, dayBefore(latestStart)),
  )
  return [
    db
      .delete(periods.table)
      .where(
        and(
          scope,
          eq(periods.validFrom, latestStart),
          isNull(periods.validTo),
          owned,
          exists(db.select({ one }).from(periods.table).where(previous)),
        ),
      )
      .returning({ id: periods.parentKey }),
    db
      .update(periods.table)
      .set({ validTo: null })
      .where(
        and(
          previous,
          notExists(
            db
              .select({ one })
              .from(periods.table)
              .where(and(scope, eq(periods.validFrom, latestStart))),
          ),
        ),
      ),
  ]
}
