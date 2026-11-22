// A flat's tenancies (openspec: tenancies). Each write carries the owner
// check and the no-overlap rule in its own statement, so a role lost or a
// tenancy added between the read and the write changes nothing. The server
// checks the same rules first to give the reason.
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  not,
  notExists,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import type { IsoDate } from '#/lib/dates'
import {
  properties,
  propertyAccess,
  recurringAmounts,
  rentPayments,
  tenancies,
  type ContractType,
  type NoticeGiver,
} from '#/server/db/schema'
import {
  recurringAmountRepository,
  type Expected,
} from '#/features/recurring-amounts/recurring-amount.repository.server'
import { atomically, type Db } from '#/server/platform/db.server'

/** What an owner enters for a tenancy. */
export interface TenancyFields {
  tenantName: string
  tenantPhone: string | null
  tenantEmail: string | null
  contractType: ContractType
  contractMade: IsoDate
  /** The start. */
  validFrom: IsoDate
  /** A fixed term's end; null for an open-ended tenancy. */
  termEnd: IsoDate | null
  dueDay: number
}

export interface Tenancy extends TenancyFields {
  id: string
  propertyId: string
  /** The last day; null while an open-ended tenancy runs. */
  validTo: IsoDate | null
  noticeGivenBy: NoticeGiver | null
  noticeDate: IsoDate | null
}

/** How a tenancy is ended. */
export interface Ending {
  noticeGivenBy: NoticeGiver
  noticeDate: IsoDate
  lastDay: IsoDate
}

const columns = {
  id: tenancies.id,
  propertyId: tenancies.propertyId,
  tenantName: tenancies.tenantName,
  tenantPhone: tenancies.tenantPhone,
  tenantEmail: tenancies.tenantEmail,
  contractType: tenancies.contractType,
  contractMade: tenancies.contractMade,
  validFrom: tenancies.validFrom,
  validTo: tenancies.validTo,
  termEnd: tenancies.termEnd,
  dueDay: tenancies.dueDay,
  noticeGivenBy: tenancies.noticeGivenBy,
  noticeDate: tenancies.noticeDate,
}

export function tenancyRepository(db: Db) {
  const other = alias(tenancies, 'other_tenancy')

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
   * No other tenancy of the flat overlaps `from`–`to` (none: indefinitely).
   * `except` leaves out the tenancy being changed.
   */
  const noOverlap = (
    propertyId: string,
    from: IsoDate,
    to: IsoDate | null,
    except?: string,
  ): SQL | undefined =>
    notExists(
      db
        .select({ one: sql`1` })
        .from(other)
        .where(
          and(
            eq(other.propertyId, propertyId),
            except === undefined ? undefined : ne(other.id, except),
            to === null ? undefined : lte(other.validFrom, to),
            or(isNull(other.validTo), gte(other.validTo, from)),
          ),
        ),
    )

  /**
   * None of the tenancy's rent payments falls outside the months of
   * `from`–`to` (none: indefinitely), so payments stay inside their tenancy.
   */
  const paymentsInside = (from: IsoDate, to: IsoDate | null): SQL =>
    notExists(
      db
        .select({ one: sql`1` })
        .from(rentPayments)
        .where(
          and(
            eq(rentPayments.tenancyId, tenancies.id),
            or(
              lt(rentPayments.month, from.slice(0, 7)),
              to === null ? undefined : gt(rentPayments.month, to.slice(0, 7)),
            ),
          ),
        ),
    )

  /** No rent payment of the tenancy is for a month after `lastDay`'s. */
  const paymentsUntil = (lastDay: IsoDate): SQL =>
    notExists(
      db
        .select({ one: sql`1` })
        .from(rentPayments)
        .where(
          and(
            eq(rentPayments.tenancyId, tenancies.id),
            gt(rentPayments.month, lastDay.slice(0, 7)),
          ),
        ),
    )

  const ownTenancy = (actorId: string, propertyId: string, id: string) =>
    and(
      eq(tenancies.id, id),
      eq(tenancies.propertyId, propertyId),
      isOwner(actorId, propertyId),
    )

  /**
   * The insert of a new tenancy, for the caller's atomically() batch: it
   * writes nothing unless the actor owns the flat and nothing overlaps.
   */
  function createStatement(
    actorId: string,
    propertyId: string,
    fields: TenancyFields,
    now: Date,
    ending?: Ending,
  ) {
    const id = crypto.randomUUID()
    // The last day: a recorded ending's, else the fixed term's end.
    const validTo = ending?.lastDay ?? fields.termEnd
    const statement = db
      .insert(tenancies)
      .select(
        db
          .select({
            id: sql<string>`${id}`.as('id'),
            propertyId: properties.id,
            tenantName: sql<string>`${fields.tenantName}`.as('tenant_name'),
            tenantPhone: sql<string | null>`${fields.tenantPhone}`.as(
              'tenant_phone',
            ),
            tenantEmail: sql<string | null>`${fields.tenantEmail}`.as(
              'tenant_email',
            ),
            contractType: sql<ContractType>`${fields.contractType}`.as(
              'contract_type',
            ),
            contractMade: sql<string>`${fields.contractMade}`.as(
              'contract_made',
            ),
            validFrom: sql<string>`${fields.validFrom}`.as('valid_from'),
            validTo: sql<string | null>`${validTo}`.as('valid_to'),
            termEnd: sql<string | null>`${fields.termEnd}`.as('term_end'),
            dueDay: sql<number>`${fields.dueDay}`.as('due_day'),
            noticeGivenBy: sql<NoticeGiver | null>`${
              ending?.noticeGivenBy ?? null
            }`.as('notice_given_by'),
            noticeDate: sql<string | null>`${ending?.noticeDate ?? null}`.as(
              'notice_date',
            ),
            createdBy: sql<string>`${actorId}`.as('created_by'),
            createdAt: sql<number>`${now.getTime()}`.as('created_at'),
            updatedAt: sql<number>`${now.getTime()}`.as('updated_at'),
          })
          .from(properties)
          .where(
            and(
              eq(properties.id, propertyId),
              isOwner(actorId, propertyId),
              noOverlap(propertyId, fields.validFrom, validTo),
            ),
          ),
      )
      .returning({ id: tenancies.id })
    return { id, statement }
  }

  return {
    /** The flat's tenancies, newest first. */
    async forProperty(propertyId: string): Promise<Tenancy[]> {
      return db
        .select(columns)
        .from(tenancies)
        .where(eq(tenancies.propertyId, propertyId))
        .orderBy(desc(tenancies.validFrom))
    },

    /** The months (`YYYY-MM`) the tenancy has rent payments for. */
    async paymentMonths(tenancyId: string): Promise<string[]> {
      const rows = await db
        .selectDistinct({ month: rentPayments.month })
        .from(rentPayments)
        .where(eq(rentPayments.tenancyId, tenancyId))
        .orderBy(asc(rentPayments.month))
      return rows.map((row) => row.month)
    },

    /** A tenancy, or null. */
    async get(tenancyId: string): Promise<Tenancy | null> {
      const row = await db
        .select(columns)
        .from(tenancies)
        .where(eq(tenancies.id, tenancyId))
        .get()
      return row ?? null
    },

    /**
     * The flats' tenancies that haven't ended before `on`, oldest first: the
     * running one, then those to come.
     */
    async currentFor(propertyIds: string[], on: IsoDate): Promise<Tenancy[]> {
      if (propertyIds.length === 0) {
        return []
      }
      return db
        .select(columns)
        .from(tenancies)
        .where(
          and(
            inArray(tenancies.propertyId, propertyIds),
            or(isNull(tenancies.validTo), gte(tenancies.validTo, on)),
          ),
        )
        .orderBy(asc(tenancies.validFrom))
    },

    /**
     * Adds a tenancy and, when given, sets the flat's rent, all or nothing:
     * the rent statements apply only if the tenancy row went in, and the
     * batch's last statement takes the tenancy out again unless the rent
     * period it needs is there. `overlaps` also covers a lost owner role.
     */
    async createWithRent(
      actorId: string,
      propertyId: string,
      fields: TenancyFields,
      rent:
        (Omit<Expected, 'propertyId' | 'actorId'> & { amount: number }) | null,
      now: Date,
      /** An ending recorded with the tenancy, for an earlier one. */
      ending?: Ending,
    ): Promise<
      | { outcome: 'created'; id: string }
      | { outcome: 'overlaps' }
      | { outcome: 'rent_changed' }
    > {
      const { id, statement } = createStatement(
        actorId,
        propertyId,
        fields,
        now,
        ending,
      )
      if (rent === null) {
        const [inserted] = await atomically(db, [statement])
        return inserted.length > 0
          ? { outcome: 'created', id }
          : { outcome: 'overlaps' }
      }
      const added = exists(
        db
          .select({ one: sql`1` })
          .from(other)
          .where(eq(other.id, id)),
      )
      // The rent the tenancy was saved with: the latest period, from `from`.
      const rentSet = exists(
        db
          .select({ one: sql`1` })
          .from(recurringAmounts)
          .where(
            and(
              eq(recurringAmounts.propertyId, propertyId),
              eq(recurringAmounts.kind, 'rent'),
              eq(recurringAmounts.validFrom, rent.from),
              isNull(recurringAmounts.validTo),
              eq(recurringAmounts.amount, rent.amount),
            ),
          ),
      )
      const results = await atomically(db, [
        statement,
        ...recurringAmountRepository(db).amountStatements(
          { ...rent, propertyId, actorId, kind: 'rent' },
          added,
        ),
        db
          .delete(tenancies)
          .where(and(eq(tenancies.id, id), not(rentSet)))
          .returning({ id: tenancies.id }),
      ])
      const inserted = results[0]
      const removed = results.at(-1) as unknown[]
      if (inserted.length === 0) {
        return { outcome: 'overlaps' }
      }
      return removed.length > 0
        ? { outcome: 'rent_changed' }
        : { outcome: 'created', id }
    },

    /** Adds a tenancy. Null when the actor isn't an owner or it overlaps. */
    async create(
      actorId: string,
      propertyId: string,
      fields: TenancyFields,
      now: Date,
    ): Promise<string | null> {
      const { statement } = createStatement(actorId, propertyId, fields, now)
      const [inserted] = await atomically(db, [statement])
      return inserted[0]?.id ?? null
    },

    /**
     * Corrects a tenancy in place. `validTo` is its last day after the
     * correction, and the write applies only while the stored last day is
     * still `expectedValidTo`, so an ending recorded meanwhile isn't lost.
     */
    async update(
      actorId: string,
      propertyId: string,
      tenancyId: string,
      fields: TenancyFields,
      change: { validTo: IsoDate | null; expectedValidTo: IsoDate | null },
      now: Date,
    ): Promise<boolean> {
      const [updated] = await atomically(db, [
        db
          .update(tenancies)
          .set({ ...fields, validTo: change.validTo, updatedAt: now })
          .where(
            and(
              ownTenancy(actorId, propertyId, tenancyId),
              change.expectedValidTo === null
                ? isNull(tenancies.validTo)
                : eq(tenancies.validTo, change.expectedValidTo),
              noOverlap(
                propertyId,
                fields.validFrom,
                change.validTo,
                tenancyId,
              ),
              paymentsInside(fields.validFrom, change.validTo),
            ),
          )
          .returning({ id: tenancies.id }),
      ])
      return updated.length > 0
    },

    /** Ends a tenancy that hasn't been ended. */
    async end(
      actorId: string,
      propertyId: string,
      tenancyId: string,
      ending: Ending,
      now: Date,
    ): Promise<boolean> {
      const [updated] = await atomically(db, [
        db
          .update(tenancies)
          .set({
            validTo: ending.lastDay,
            noticeGivenBy: ending.noticeGivenBy,
            noticeDate: ending.noticeDate,
            updatedAt: now,
          })
          .where(
            and(
              ownTenancy(actorId, propertyId, tenancyId),
              isNull(tenancies.noticeGivenBy),
              paymentsUntil(ending.lastDay),
            ),
          )
          .returning({ id: tenancies.id }),
      ])
      return updated.length > 0
    },

    /**
     * Removes a tenancy that starts after `today`. False when it has started,
     * isn't the flat's or the actor isn't an owner.
     */
    async removeNotStarted(
      actorId: string,
      propertyId: string,
      tenancyId: string,
      today: IsoDate,
    ): Promise<boolean> {
      const [removed] = await atomically(db, [
        db
          .delete(tenancies)
          .where(
            and(
              ownTenancy(actorId, propertyId, tenancyId),
              gt(tenancies.validFrom, today),
              notExists(
                db
                  .select({ one: sql`1` })
                  .from(rentPayments)
                  .where(eq(rentPayments.tenancyId, tenancies.id)),
              ),
            ),
          )
          .returning({ id: tenancies.id }),
      ])
      return removed.length > 0
    },

    /**
     * Cancels an ending: the last day goes back to the fixed term's end, or
     * none. Nothing changes if that would overlap a later tenancy.
     */
    async cancelEnding(
      actorId: string,
      propertyId: string,
      tenancy: Pick<Tenancy, 'id' | 'validFrom' | 'termEnd'>,
      now: Date,
    ): Promise<boolean> {
      const [updated] = await atomically(db, [
        db
          .update(tenancies)
          .set({
            validTo: sql`${tenancies.termEnd}`,
            noticeGivenBy: null,
            noticeDate: null,
            updatedAt: now,
          })
          .where(
            and(
              ownTenancy(actorId, propertyId, tenancy.id),
              isNotNull(tenancies.noticeGivenBy),
              noOverlap(
                propertyId,
                tenancy.validFrom,
                tenancy.termEnd,
                tenancy.id,
              ),
            ),
          )
          .returning({ id: tenancies.id }),
      ])
      return updated.length > 0
    },
  }
}
export type TenancyRepository = ReturnType<typeof tenancyRepository>
