// Deposit returns (openspec: deposits). A return is written together with
// the rent payments that record the rent kept, all or none, and every
// statement carries the owner check and the tenancy belonging to the flat,
// so a role lost between the read and the write changes nothing. The server
// checks the same rules first to give the reason.
import {
  and,
  asc,
  eq,
  exists,
  gte,
  inArray,
  lte,
  notExists,
  sql,
} from 'drizzle-orm'
import type { IsoDate } from '#/lib/dates'
import { inChunks } from '#/server/db/chunks'
import {
  depositReturns,
  propertyAccess,
  rentPayments,
  tenancies,
} from '#/server/db/schema'
import { atomically, type Db } from '#/server/platform/db.server'

export interface DepositReturn {
  id: string
  tenancyId: string
  returnedOn: IsoDate
  /** Kept for unpaid rent, cents. */
  rentKept: number
  /** Kept for damage and cleaning, cents. */
  damageKept: number
  note: string | null
}

/** A return of one of several flats, for the year summary. */
export interface FlatDepositReturn extends DepositReturn {
  propertyId: string
}

/** What an owner enters for a return. */
export interface DepositReturnFields {
  returnedOn: IsoDate
  rentKept: number
  damageKept: number
  note: string | null
}

/** A rent payment recorded as kept from the deposit. */
export interface KeptPayment {
  month: string
  /** Cents. */
  amount: number
}

const columns = {
  id: depositReturns.id,
  tenancyId: depositReturns.tenancyId,
  returnedOn: depositReturns.returnedOn,
  rentKept: depositReturns.rentKept,
  damageKept: depositReturns.damageKept,
  note: depositReturns.note,
}

export function depositReturnRepository(db: Db) {
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

  /** The actor owns the flat, and the return belongs to one of its tenancies. */
  const ownsReturn = (actorId: string, propertyId: string, returnId: string) =>
    and(
      isOwner(actorId, propertyId),
      exists(
        db
          .select({ one: sql`1` })
          .from(tenancies)
          .where(
            and(
              eq(tenancies.id, depositReturns.tenancyId),
              eq(tenancies.propertyId, propertyId),
            ),
          ),
      ),
      eq(depositReturns.id, returnId),
    )

  /** The payments of a return, applied only while the return exists. */
  const paymentStatements = (
    actorId: string,
    propertyId: string,
    returnId: string,
    payments: KeptPayment[],
    now: Date,
  ) =>
    payments.map((payment) =>
      db.insert(rentPayments).select(
        db
          .select({
            id: sql<string>`${crypto.randomUUID()}`.as('id'),
            tenancyId: depositReturns.tenancyId,
            month: sql<string>`${payment.month}`.as('month'),
            amount: sql<number>`${payment.amount}`.as('amount'),
            paidOn: depositReturns.returnedOn,
            depositReturnId: depositReturns.id,
            createdBy: sql<string>`${actorId}`.as('created_by'),
            createdAt: sql<number>`${now.getTime()}`.as('created_at'),
          })
          .from(depositReturns)
          .where(ownsReturn(actorId, propertyId, returnId)),
      ),
    )

  return {
    /** The returns of the tenancies, one per tenancy at most. */
    async forTenancies(tenancyIds: string[]): Promise<DepositReturn[]> {
      return inChunks(tenancyIds, (chunk) =>
        db
          .select(columns)
          .from(depositReturns)
          .where(inArray(depositReturns.tenancyId, chunk)),
      )
    },

    /** The return of one tenancy, if any. */
    async forTenancy(tenancyId: string): Promise<DepositReturn | undefined> {
      const [row] = await db
        .select(columns)
        .from(depositReturns)
        .where(eq(depositReturns.tenancyId, tenancyId))
      return row
    },

    /** The returns of the flats' tenancies dated in `year`, oldest first. */
    async forPropertiesYear(
      propertyIds: string[],
      year: number,
    ): Promise<FlatDepositReturn[]> {
      return inChunks(propertyIds, (chunk) =>
        db
          .select({ ...columns, propertyId: tenancies.propertyId })
          .from(depositReturns)
          .innerJoin(tenancies, eq(tenancies.id, depositReturns.tenancyId))
          .where(
            and(
              inArray(tenancies.propertyId, chunk),
              gte(depositReturns.returnedOn, `${String(year)}-01-01`),
              lte(depositReturns.returnedOn, `${String(year)}-12-31`),
            ),
          )
          .orderBy(asc(depositReturns.returnedOn)),
      )
    },

    /**
     * Records the return of a tenancy with the payments for the rent kept.
     * Null unless the actor owns the flat, the tenancy is the flat's and it
     * has no return yet.
     */
    async record(
      actorId: string,
      propertyId: string,
      tenancyId: string,
      fields: DepositReturnFields,
      payments: KeptPayment[],
      now: Date,
    ): Promise<string | null> {
      const id = crypto.randomUUID()
      const [inserted] = await atomically(db, [
        db
          .insert(depositReturns)
          .select(
            db
              .select({
                id: sql<string>`${id}`.as('id'),
                tenancyId: tenancies.id,
                returnedOn: sql<string>`${fields.returnedOn}`.as('returned_on'),
                rentKept: sql<number>`${fields.rentKept}`.as('rent_kept'),
                damageKept: sql<number>`${fields.damageKept}`.as('damage_kept'),
                note: sql<string | null>`${fields.note}`.as('note'),
                createdBy: sql<string>`${actorId}`.as('created_by'),
                createdAt: sql<number>`${now.getTime()}`.as('created_at'),
                updatedAt: sql<number>`${now.getTime()}`.as('updated_at'),
              })
              .from(tenancies)
              .where(
                and(
                  eq(tenancies.id, tenancyId),
                  eq(tenancies.propertyId, propertyId),
                  isOwner(actorId, propertyId),
                  notExists(
                    db
                      .select({ one: sql`1` })
                      .from(depositReturns)
                      .where(eq(depositReturns.tenancyId, tenancyId)),
                  ),
                ),
              ),
          )
          .returning({ id: depositReturns.id }),
        ...paymentStatements(actorId, propertyId, id, payments, now),
      ])
      return inserted[0]?.id ?? null
    },

    /**
     * Corrects a return: its fields are updated and its payments replaced.
     * False unless the actor owns the flat and the return is one of its.
     */
    async update(
      actorId: string,
      propertyId: string,
      returnId: string,
      fields: DepositReturnFields,
      payments: KeptPayment[],
      now: Date,
    ): Promise<boolean> {
      const [, updated] = await atomically(db, [
        // The payments go first, while the return still exists unchanged:
        // each statement repeats the same guard.
        db.delete(rentPayments).where(
          and(
            eq(rentPayments.depositReturnId, returnId),
            exists(
              db
                .select({ one: sql`1` })
                .from(depositReturns)
                .where(ownsReturn(actorId, propertyId, returnId)),
            ),
          ),
        ),
        db
          .update(depositReturns)
          .set({ ...fields, updatedAt: now })
          .where(ownsReturn(actorId, propertyId, returnId))
          .returning({ id: depositReturns.id }),
        ...paymentStatements(actorId, propertyId, returnId, payments, now),
      ])
      return updated.length > 0
    },

    /** Deletes a return; its payments go with it. False unless allowed. */
    async remove(
      actorId: string,
      propertyId: string,
      returnId: string,
    ): Promise<boolean> {
      const [removed] = await atomically(db, [
        db
          .delete(depositReturns)
          .where(ownsReturn(actorId, propertyId, returnId))
          .returning({ id: depositReturns.id }),
      ])
      return removed.length > 0
    },
  }
}

export type DepositReturnRepository = ReturnType<typeof depositReturnRepository>
