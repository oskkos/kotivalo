// Rent payments of a flat's tenancies (openspec: rent-payments). Each write
// carries the owner check, the tenancy belonging to the flat and, for a new
// payment, the month lying inside the tenancy, in its own statement, so a
// role lost or a tenancy corrected between the read and the write changes
// nothing. The server checks the same rules first to give the reason.
import {
  and,
  asc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import { lastDayOfMonth, type IsoDate } from '#/lib/dates'
import {
  propertyAccess,
  rentPayments,
  tenancies,
  user,
} from '#/server/db/schema'
import { atomically, type Db } from '#/server/platform/db.server'

export interface RentPayment {
  id: string
  tenancyId: string
  /** The rent's month, `YYYY-MM`. */
  month: string
  /** Cents. */
  amount: number
  paidOn: IsoDate
  /** Set when the rent was kept from a deposit (openspec: deposits). */
  depositReturnId: string | null
  /** The display name of the user who recorded it. */
  recordedBy: string
}

/** A payment of one of several flats, for this month's rent on the list. */
export interface FlatRentPayment {
  propertyId: string
  tenancyId: string
  month: string
  /** Cents. */
  amount: number
  paidOn: IsoDate
}

export interface NewRentPayment {
  tenancyId: string
  month: string
  amount: number
  paidOn: IsoDate
}

export function rentPaymentRepository(db: Db) {
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

  return {
    /** The payments of the flat's tenancies, by month, then payment date. */
    async forProperty(propertyId: string): Promise<RentPayment[]> {
      return db
        .select({
          id: rentPayments.id,
          tenancyId: rentPayments.tenancyId,
          month: rentPayments.month,
          amount: rentPayments.amount,
          paidOn: rentPayments.paidOn,
          depositReturnId: rentPayments.depositReturnId,
          recordedBy: user.name,
        })
        .from(rentPayments)
        .innerJoin(tenancies, eq(tenancies.id, rentPayments.tenancyId))
        .innerJoin(user, eq(user.id, rentPayments.createdBy))
        .where(eq(tenancies.propertyId, propertyId))
        .orderBy(
          asc(rentPayments.month),
          asc(rentPayments.paidOn),
          asc(rentPayments.createdAt),
        )
    },

    /**
     * The payments of the flats' tenancies, by month, then payment date, as
     * `forProperty` gives them.
     */
    async forProperties(propertyIds: string[]): Promise<FlatRentPayment[]> {
      if (propertyIds.length === 0) {
        return []
      }
      return db
        .select({
          propertyId: tenancies.propertyId,
          tenancyId: rentPayments.tenancyId,
          month: rentPayments.month,
          amount: rentPayments.amount,
          paidOn: rentPayments.paidOn,
        })
        .from(rentPayments)
        .innerJoin(tenancies, eq(tenancies.id, rentPayments.tenancyId))
        .where(inArray(tenancies.propertyId, propertyIds))
        .orderBy(
          asc(rentPayments.month),
          asc(rentPayments.paidOn),
          asc(rentPayments.createdAt),
        )
    },

    /** The payments of the flats' tenancies for the rent of `month`. */
    async forMonth(
      propertyIds: string[],
      month: string,
    ): Promise<FlatRentPayment[]> {
      if (propertyIds.length === 0) {
        return []
      }
      return db
        .select({
          propertyId: tenancies.propertyId,
          tenancyId: rentPayments.tenancyId,
          month: rentPayments.month,
          amount: rentPayments.amount,
          paidOn: rentPayments.paidOn,
        })
        .from(rentPayments)
        .innerJoin(tenancies, eq(tenancies.id, rentPayments.tenancyId))
        .where(
          and(
            inArray(tenancies.propertyId, propertyIds),
            eq(rentPayments.month, month),
          ),
        )
    },

    /**
     * Records a payment. Null unless the actor owns the flat, the tenancy is
     * the flat's and it runs in the payment's month.
     */
    async record(
      actorId: string,
      propertyId: string,
      payment: NewRentPayment,
      now: Date,
    ): Promise<string | null> {
      const id = crypto.randomUUID()
      const firstDay = `${payment.month}-01`
      const lastDay = lastDayOfMonth(payment.month)
      const [inserted] = await atomically(db, [
        db
          .insert(rentPayments)
          .select(
            db
              .select({
                id: sql<string>`${id}`.as('id'),
                tenancyId: tenancies.id,
                month: sql<string>`${payment.month}`.as('month'),
                amount: sql<number>`${payment.amount}`.as('amount'),
                paidOn: sql<string>`${payment.paidOn}`.as('paid_on'),
                depositReturnId: sql<string | null>`${null}`.as(
                  'deposit_return_id',
                ),
                createdBy: sql<string>`${actorId}`.as('created_by'),
                createdAt: sql<number>`${now.getTime()}`.as('created_at'),
              })
              .from(tenancies)
              .where(
                and(
                  eq(tenancies.id, payment.tenancyId),
                  eq(tenancies.propertyId, propertyId),
                  lte(tenancies.validFrom, lastDay),
                  or(
                    isNull(tenancies.validTo),
                    gte(tenancies.validTo, firstDay),
                  ),
                  isOwner(actorId, propertyId),
                ),
              ),
          )
          .returning({ id: rentPayments.id }),
      ])
      return inserted[0]?.id ?? null
    },

    /** Whether the payment, one of the flat's, was kept from a deposit. */
    async isFromDeposit(
      propertyId: string,
      paymentId: string,
    ): Promise<boolean> {
      const rows = await db
        .select({ one: sql`1` })
        .from(rentPayments)
        .innerJoin(tenancies, eq(tenancies.id, rentPayments.tenancyId))
        .where(
          and(
            eq(rentPayments.id, paymentId),
            eq(tenancies.propertyId, propertyId),
            isNotNull(rentPayments.depositReturnId),
          ),
        )
      return rows.length > 0
    },

    /**
     * Deletes a payment. False unless the actor owns the flat and the
     * payment belongs to one of its tenancies and wasn't kept from a deposit.
     */
    async remove(
      actorId: string,
      propertyId: string,
      paymentId: string,
    ): Promise<boolean> {
      const [removed] = await atomically(db, [
        db
          .delete(rentPayments)
          .where(
            and(
              eq(rentPayments.id, paymentId),
              isNull(rentPayments.depositReturnId),
              exists(
                db
                  .select({ one: sql`1` })
                  .from(tenancies)
                  .where(
                    and(
                      eq(tenancies.id, rentPayments.tenancyId),
                      eq(tenancies.propertyId, propertyId),
                    ),
                  ),
              ),
              isOwner(actorId, propertyId),
            ),
          )
          .returning({ id: rentPayments.id }),
      ])
      return removed.length > 0
    },
  }
}

export type RentPaymentRepository = ReturnType<typeof rentPaymentRepository>
