// A flat's usage charges with their amount periods (openspec: usage-charges).
// Each write carries the owner check and the expected latest start in its
// statements (src/server/db/periods.ts), so a role lost or a period changed
// between the read and the write applies nothing. The server checks the
// same rules first to give the reason.
import { and, asc, eq, exists, ne, notExists, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { IsoDate } from '#/lib/dates'
import {
  periodUndoStatements,
  periodWriteStatements,
  usageChargePeriods,
} from '#/server/db/periods'
import {
  properties,
  propertyAccess,
  usageChargeAmounts,
  usageCharges,
  type ChargeBasis,
  type ChargeKind,
} from '#/server/db/schema'
import { atomically, type Db } from '#/server/platform/db.server'
import type { UsageChargePeriods } from './months'

export interface NewUsageCharge {
  actorId: string
  propertyId: string
  kind: ChargeKind
  basis: ChargeBasis
  /** Set for the kind `other`. */
  description: string | null
  /** Cents per month, or per occupant per month. */
  amount: number
  from: IsoDate
}

export interface UsageChargeWrite {
  actorId: string
  propertyId: string
  chargeId: string
  amount: number
  from: IsoDate
  latestStart: IsoDate
  /** True when `from` is the latest period's start: it is corrected. */
  corrects?: boolean
}

/** An undo's expectation; no previous start means removing the charge. */
export interface UsageChargeUndo {
  actorId: string
  propertyId: string
  chargeId: string
  latestStart: IsoDate
  previousStart: IsoDate | null
}

export function usageChargeRepository(db: Db) {
  const one = sql`1`

  /** The actor owns the flat. */
  const isOwner = (actorId: string, propertyId: string) =>
    exists(
      db
        .select({ one })
        .from(propertyAccess)
        .where(
          and(
            eq(propertyAccess.propertyId, propertyId),
            eq(propertyAccess.userId, actorId),
            eq(propertyAccess.role, 'owner'),
          ),
        ),
    )

  /** The charge is the flat's and the actor owns the flat. */
  const ownsCharge = (actorId: string, propertyId: string, chargeId: string) =>
    and(
      isOwner(actorId, propertyId),
      exists(
        db
          .select({ one })
          .from(usageCharges)
          .where(
            and(
              eq(usageCharges.id, chargeId),
              eq(usageCharges.propertyId, propertyId),
            ),
          ),
      ),
    )

  return {
    /** The flat's usage charges with their periods, oldest first. */
    async forProperty(propertyId: string): Promise<UsageChargePeriods[]> {
      const charges = await db
        .select()
        .from(usageCharges)
        .where(eq(usageCharges.propertyId, propertyId))
      if (charges.length === 0) {
        return []
      }
      const amounts = await db
        .select({
          chargeId: usageChargeAmounts.usageChargeId,
          validFrom: usageChargeAmounts.validFrom,
          validTo: usageChargeAmounts.validTo,
          value: usageChargeAmounts.amount,
        })
        .from(usageChargeAmounts)
        .innerJoin(
          usageCharges,
          eq(usageCharges.id, usageChargeAmounts.usageChargeId),
        )
        .where(eq(usageCharges.propertyId, propertyId))
        .orderBy(asc(usageChargeAmounts.validFrom))
      const result = charges.map((charge) => ({
        id: charge.id,
        kind: charge.kind,
        basis: charge.basis,
        description: charge.description,
        periods: amounts
          .filter((a) => a.chargeId === charge.id)
          .map(({ validFrom, validTo, value }) => ({
            validFrom,
            validTo,
            value,
          })),
      }))
      // In the order they were started, so the pages keep a stable order.
      return result.sort(
        (a, b) =>
          (a.periods[0]?.validFrom ?? '').localeCompare(
            b.periods[0]?.validFrom ?? '',
          ) || a.id.localeCompare(b.id),
      )
    },

    /**
     * Adds a usage charge with its first period, both or neither. Returns
     * its id, or null when the actor isn't an owner.
     */
    async add(charge: NewUsageCharge): Promise<string | null> {
      const { actorId, propertyId } = charge
      const chargeId = crypto.randomUUID()
      const statements: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = [
        db
          .insert(usageCharges)
          .select(
            db
              .select({
                id: sql<string>`${chargeId}`.as('id'),
                propertyId: properties.id,
                kind: sql<ChargeKind>`${charge.kind}`.as('kind'),
                basis: sql<ChargeBasis>`${charge.basis}`.as('basis'),
                description: sql<string | null>`${charge.description}`.as(
                  'description',
                ),
              })
              .from(properties)
              .where(
                and(
                  eq(properties.id, propertyId),
                  isOwner(actorId, propertyId),
                ),
              ),
          )
          .returning({ id: usageCharges.id }),
        ...periodWriteStatements(db, usageChargePeriods, {
          parentId: chargeId,
          value: charge.amount,
          from: charge.from,
          latestStart: null,
          owned: ownsCharge(actorId, propertyId, chargeId),
        }),
      ]
      const results = await atomically(db, statements)
      return (results[0] as unknown[]).length > 0 ? chargeId : null
    },

    /** A new amount from `write.from`, or a correction of the latest. */
    async setAmount(write: UsageChargeWrite): Promise<boolean> {
      const results = await atomically(
        db,
        periodWriteStatements(db, usageChargePeriods, {
          parentId: write.chargeId,
          value: write.amount,
          from: write.from,
          latestStart: write.latestStart,
          corrects: write.corrects ?? false,
          owned: ownsCharge(write.actorId, write.propertyId, write.chargeId),
        }),
      )
      return (results.at(-1) as unknown[]).length > 0
    },

    /**
     * Undoes the latest change: deletes the latest period and reopens the
     * previous one, or removes the charge with its only period.
     */
    async undoLatest(undo: UsageChargeUndo): Promise<boolean> {
      const { actorId, propertyId, chargeId, latestStart } = undo
      if (undo.previousStart !== null) {
        const results = await atomically(
          db,
          periodUndoStatements(db, usageChargePeriods, {
            parentId: chargeId,
            latestStart,
            previousStart: undo.previousStart,
            owned: ownsCharge(actorId, propertyId, chargeId),
          }),
        )
        return (results[0] as unknown[]).length > 0
      }
      const results = await atomically(db, [
        db
          .delete(usageCharges)
          .where(
            and(
              eq(usageCharges.id, chargeId),
              eq(usageCharges.propertyId, propertyId),
              isOwner(actorId, propertyId),
              exists(
                db
                  .select({ one })
                  .from(usageChargeAmounts)
                  .where(
                    and(
                      eq(usageChargeAmounts.usageChargeId, chargeId),
                      eq(usageChargeAmounts.validFrom, latestStart),
                    ),
                  ),
              ),
              notExists(
                db
                  .select({ one })
                  .from(usageChargeAmounts)
                  .where(
                    and(
                      eq(usageChargeAmounts.usageChargeId, chargeId),
                      ne(usageChargeAmounts.validFrom, latestStart),
                    ),
                  ),
              ),
            ),
          )
          .returning({ id: usageCharges.id }),
      ])
      return (results[0] as unknown[]).length > 0
    },
  }
}

export type UsageChargeRepository = ReturnType<typeof usageChargeRepository>
