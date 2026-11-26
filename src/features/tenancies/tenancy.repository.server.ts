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
  notExists,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { alias } from 'drizzle-orm/sqlite-core'
import { dayBefore, type IsoDate } from '#/lib/dates'
import { inChunks } from '#/server/db/chunks'
import {
  properties,
  propertyAccess,
  rentPayments,
  tenancies,
  tenancyOccupants,
  tenancyRents,
  tenantFeeAmounts,
  tenantFees,
  type ChargeBasis,
  type ChargeKind,
  type ContractType,
  type NoticeGiver,
} from '#/server/db/schema'
import type { Period } from '#/features/recurring-amounts/periods'
import { atomically, type Db } from '#/server/platform/db.server'
import {
  occupantsPeriods,
  periodUndoStatements,
  tenantFeePeriods,
  periodWriteStatements,
} from '#/server/db/periods'

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

/**
 * A rent write's expectation: the tenancy's latest rent period's start as
 * read, or none, so a concurrent change makes the write apply nothing.
 */
export interface RentWrite {
  actorId: string
  propertyId: string
  tenancyId: string
  /** Cents per month. */
  amount: number
  from: IsoDate
  latestStart: IsoDate | null
  /**
   * True when `from` is the start of one of the tenancy's periods: the
   * write corrects that period's amount, while it still starts there.
   */
  corrects?: boolean
  /**
   * The first period's start as read, when `from` is before it: the write
   * fills the months up to it instead of changing the latest period.
   */
  firstStart?: IsoDate
}

/** An occupants write's expectation: the latest period's start as read. */
export interface OccupantsWrite {
  actorId: string
  propertyId: string
  tenancyId: string
  persons: number
  from: IsoDate
  latestStart: IsoDate | null
  /** True when `from` is the latest period's start: it is corrected. */
  corrects?: boolean
}

/** A new tenant fee with its first amount from `from`. */
export interface NewFee {
  actorId: string
  propertyId: string
  tenancyId: string
  kind: ChargeKind
  basis: ChargeBasis
  /** Set for the kind `other`. */
  description: string | null
  /** Cents per month or per occupant per month. */
  amount: number
  from: IsoDate
}

/** A fee amount write's expectation: the latest period's start as read. */
export interface FeeAmountWrite {
  actorId: string
  propertyId: string
  tenancyId: string
  feeId: string
  amount: number
  from: IsoDate
  latestStart: IsoDate
  /** True when `from` is the latest period's start: it is corrected. */
  corrects?: boolean
}

/** A fee undo's expectation; no previous start means removing the fee. */
export interface FeeUndo {
  actorId: string
  propertyId: string
  tenancyId: string
  feeId: string
  latestStart: IsoDate
  previousStart: IsoDate | null
}

/** An undo's expectation: the latest and previous rent periods' starts. */
export interface RentUndo {
  actorId: string
  propertyId: string
  tenancyId: string
  latestStart: IsoDate
  previousStart: IsoDate
}

/** A fee the tenant pays on top of the rent, with its amount periods. */
export interface TenantFee {
  id: string
  tenancyId: string
  kind: ChargeKind
  basis: ChargeBasis
  /** Set for the kind `other`. */
  description: string | null
  /** Cents per month or per occupant per month, oldest first. */
  amounts: Period<number>[]
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

  /** The actor owns the flat, and the tenancy is the flat's. */
  const ownsTenancy = (
    actorId: string,
    propertyId: string,
    tenancyId: string,
  ) =>
    and(
      isOwner(actorId, propertyId),
      exists(
        db
          .select({ one: sql`1` })
          .from(other)
          .where(
            and(eq(other.id, tenancyId), eq(other.propertyId, propertyId)),
          ),
      ),
    )

  /** The fee is the tenancy's and the actor owns the tenancy's flat. */
  const ownsFee = (
    actorId: string,
    propertyId: string,
    tenancyId: string,
    feeId: string,
  ) =>
    and(
      ownsTenancy(actorId, propertyId, tenancyId),
      exists(
        db
          .select({ one: sql`1` })
          .from(tenantFees)
          .where(
            and(eq(tenantFees.id, feeId), eq(tenantFees.tenancyId, tenancyId)),
          ),
      ),
    )

  /**
   * The statements that add a tenant fee with its first amount period: the
   * period goes in only if the fee did, and the fee only if the actor owns
   * the tenancy's flat. The first returns the fee's id when it applied.
   */
  function feeStatements(
    fee: NewFee,
    feeId: string,
  ): [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] {
    const { actorId, propertyId, tenancyId } = fee
    return [
      db
        .insert(tenantFees)
        .select(
          db
            .select({
              id: sql<string>`${feeId}`.as('id'),
              tenancyId: tenancies.id,
              kind: sql<ChargeKind>`${fee.kind}`.as('kind'),
              basis: sql<ChargeBasis>`${fee.basis}`.as('basis'),
              description: sql<string | null>`${fee.description}`.as(
                'description',
              ),
            })
            .from(tenancies)
            .where(
              and(
                eq(tenancies.id, tenancyId),
                ownsTenancy(actorId, propertyId, tenancyId),
              ),
            ),
        )
        .returning({ id: tenantFees.id }),
      ...periodWriteStatements(db, tenantFeePeriods, {
        parentId: feeId,
        value: fee.amount,
        from: fee.from,
        latestStart: null,
        owned: ownsFee(actorId, propertyId, tenancyId, feeId),
      }),
    ]
  }

  const rentsOf = (tenancyId: string) => eq(tenancyRents.tenancyId, tenancyId)

  /**
   * The statements that set a tenancy's rent from `from`: on a period's
   * start (`corrects`) they correct it, otherwise they close the latest period
   * the day before and add a new one; before the first period's start they
   * add a period up to it. `onlyIf` joins every statement's condition. The
   * last statement returns a row when it applied.
   */
  function rentStatements(
    write: RentWrite,
    onlyIf?: SQL,
  ): [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] {
    const { actorId, propertyId, tenancyId, amount, from, latestStart } = write
    const scope = rentsOf(tenancyId)
    const owned = ownsTenancy(actorId, propertyId, tenancyId)
    if (write.firstStart !== undefined) {
      return [fillStatement(write, write.firstStart, owned, onlyIf)]
    }
    if (write.corrects === true) {
      return [
        db
          .update(tenancyRents)
          .set({ amount })
          .where(and(scope, eq(tenancyRents.validFrom, from), owned, onlyIf))
          .returning({ id: tenancyRents.id }),
      ]
    }
    const id = crypto.randomUUID()
    // The latest period is closed by this write (or there was none), and
    // nothing starts on or after `from`.
    const ready = and(
      eq(tenancies.id, tenancyId),
      owned,
      onlyIf,
      notExists(
        db
          .select({ one: sql`1` })
          .from(tenancyRents)
          .where(and(scope, gte(tenancyRents.validFrom, from))),
      ),
      latestStart === null
        ? notExists(
            db
              .select({ one: sql`1` })
              .from(tenancyRents)
              .where(scope),
          )
        : exists(
            db
              .select({ one: sql`1` })
              .from(tenancyRents)
              .where(
                and(
                  scope,
                  eq(tenancyRents.validFrom, latestStart),
                  eq(tenancyRents.validTo, dayBefore(from)),
                ),
              ),
          ),
    )
    const insert = db
      .insert(tenancyRents)
      .select(
        db
          .select({
            id: sql<string>`${id}`.as('id'),
            tenancyId: tenancies.id,
            amount: sql<number>`${amount}`.as('amount'),
            validFrom: sql<string>`${from}`.as('valid_from'),
            validTo: sql<null>`null`.as('valid_to'),
          })
          .from(tenancies)
          .where(ready),
      )
      .returning({ id: tenancyRents.id })
    if (latestStart === null) {
      return [insert]
    }
    return [
      db
        .update(tenancyRents)
        .set({ validTo: dayBefore(from) })
        .where(
          and(
            scope,
            eq(tenancyRents.validFrom, latestStart),
            lt(tenancyRents.validFrom, from),
            isNull(tenancyRents.validTo),
            owned,
            onlyIf,
          ),
        ),
      insert,
    ]
  }

  /**
   * Adds a period from `write.from` to the day before the first period,
   * while the first period still starts on `write.firstStart`.
   */
  function fillStatement(
    write: RentWrite,
    firstStart: IsoDate,
    owned: SQL | undefined,
    onlyIf?: SQL,
  ): BatchItem<'sqlite'> {
    const { tenancyId, amount, from } = write
    const scope = rentsOf(tenancyId)
    return db
      .insert(tenancyRents)
      .select(
        db
          .select({
            id: sql<string>`${crypto.randomUUID()}`.as('id'),
            tenancyId: tenancies.id,
            amount: sql<number>`${amount}`.as('amount'),
            validFrom: sql<string>`${from}`.as('valid_from'),
            validTo: sql<string>`${dayBefore(firstStart)}`.as('valid_to'),
          })
          .from(tenancies)
          .where(
            and(
              eq(tenancies.id, tenancyId),
              owned,
              onlyIf,
              exists(
                db
                  .select({ one: sql`1` })
                  .from(tenancyRents)
                  .where(and(scope, eq(tenancyRents.validFrom, firstStart))),
              ),
              notExists(
                db
                  .select({ one: sql`1` })
                  .from(tenancyRents)
                  .where(and(scope, lt(tenancyRents.validFrom, firstStart))),
              ),
            ),
          ),
      )
      .returning({ id: tenancyRents.id })
  }

  return {
    /** The flat's tenancies, newest first. */
    forProperty(propertyId: string): Promise<Tenancy[]> {
      return this.forProperties([propertyId])
    },

    /** The tenancies of the flats, newest first. */
    async forProperties(propertyIds: string[]): Promise<Tenancy[]> {
      if (propertyIds.length === 0) {
        return []
      }
      return db
        .select(columns)
        .from(tenancies)
        .where(inArray(tenancies.propertyId, propertyIds))
        .orderBy(desc(tenancies.validFrom))
    },

    /**
     * The tenancies' rent periods by tenancy id, oldest first (openspec:
     * tenancies, "The rent of a tenancy"). A tenancy without a rent has no
     * entry.
     */
    async rentsFor(
      tenancyIds: string[],
    ): Promise<Partial<Record<string, Period<number>[]>>> {
      if (tenancyIds.length === 0) {
        return {}
      }
      const rows = await inChunks(tenancyIds, (chunk) =>
        db
          .select()
          .from(tenancyRents)
          .where(inArray(tenancyRents.tenancyId, chunk))
          .orderBy(asc(tenancyRents.validFrom)),
      )
      const rents: Partial<Record<string, Period<number>[]>> = {}
      for (const row of rows) {
        ;(rents[row.tenancyId] ??= []).push({
          validFrom: row.validFrom,
          validTo: row.validTo,
          value: row.amount,
        })
      }
      return rents
    },

    /**
     * The occupants of tenancies as periods, oldest first (openspec:
     * tenancies, "Occupants of a tenancy"). A tenancy without any has no
     * entry.
     */
    async occupantsFor(
      tenancyIds: string[],
    ): Promise<Partial<Record<string, Period<number>[]>>> {
      if (tenancyIds.length === 0) {
        return {}
      }
      const rows = await inChunks(tenancyIds, (chunk) =>
        db
          .select()
          .from(tenancyOccupants)
          .where(inArray(tenancyOccupants.tenancyId, chunk))
          .orderBy(asc(tenancyOccupants.validFrom)),
      )
      const occupants: Partial<Record<string, Period<number>[]>> = {}
      for (const row of rows) {
        ;(occupants[row.tenancyId] ??= []).push({
          validFrom: row.validFrom,
          validTo: row.validTo,
          value: row.persons,
        })
      }
      return occupants
    },

    /**
     * The tenant fees of tenancies with their amount periods (openspec:
     * tenancies, "Tenant fees are recorded as periods"). A tenancy without
     * fees has no entry.
     */
    async feesFor(
      tenancyIds: string[],
    ): Promise<Partial<Record<string, TenantFee[]>>> {
      if (tenancyIds.length === 0) {
        return {}
      }
      const feeRows = await inChunks(tenancyIds, (chunk) =>
        db
          .select()
          .from(tenantFees)
          .where(inArray(tenantFees.tenancyId, chunk)),
      )
      if (feeRows.length === 0) {
        return {}
      }
      const amountRows = await inChunks(
        feeRows.map((fee) => fee.id),
        (chunk) =>
          db
            .select()
            .from(tenantFeeAmounts)
            .where(inArray(tenantFeeAmounts.tenantFeeId, chunk))
            .orderBy(asc(tenantFeeAmounts.validFrom)),
      )
      const fees: Partial<Record<string, TenantFee[]>> = {}
      for (const row of feeRows) {
        ;(fees[row.tenancyId] ??= []).push({
          ...row,
          amounts: amountRows
            .filter((amount) => amount.tenantFeeId === row.id)
            .map((amount) => ({
              validFrom: amount.validFrom,
              validTo: amount.validTo,
              value: amount.amount,
            })),
        })
      }
      return fees
    },

    /**
     * Sets a tenancy's rent from `write.from` (openspec: tenancies,
     * "Changing a tenancy's rent"). False when nothing applied: the actor
     * isn't an owner, the tenancy isn't the flat's, or the latest period
     * changed since it was read.
     */
    async setRent(write: RentWrite): Promise<boolean> {
      const results = await atomically(db, rentStatements(write))
      return (results.at(-1) as unknown[]).length > 0
    },

    /**
     * Adds a tenant fee with its first amount period, both or neither: the
     * period goes in only if the fee did. Returns the fee's id, or null when
     * the actor isn't an owner or the tenancy isn't the flat's.
     */
    async addFee(fee: NewFee): Promise<string | null> {
      const feeId = crypto.randomUUID()
      const results = await atomically(db, feeStatements(fee, feeId))
      return (results[0] as unknown[]).length > 0 ? feeId : null
    },

    /**
     * Gives a tenant fee a new amount from `write.from`: a new period, or a
     * correction of the latest. False when nothing applied.
     */
    async setFeeAmount(write: FeeAmountWrite): Promise<boolean> {
      const { actorId, propertyId, tenancyId, feeId } = write
      const results = await atomically(
        db,
        periodWriteStatements(db, tenantFeePeriods, {
          parentId: feeId,
          value: write.amount,
          from: write.from,
          latestStart: write.latestStart,
          corrects: write.corrects ?? false,
          owned: ownsFee(actorId, propertyId, tenancyId, feeId),
        }),
      )
      return (results.at(-1) as unknown[]).length > 0
    },

    /**
     * Undoes a tenant fee's latest change: deletes the latest period and
     * reopens the previous one, or removes the fee with its only period.
     * False when nothing applied.
     */
    async undoFeeChange(undo: FeeUndo): Promise<boolean> {
      const { actorId, propertyId, tenancyId, feeId, latestStart } = undo
      const owned = ownsFee(actorId, propertyId, tenancyId, feeId)
      if (undo.previousStart !== null) {
        const results = await atomically(
          db,
          periodUndoStatements(db, tenantFeePeriods, {
            parentId: feeId,
            latestStart,
            previousStart: undo.previousStart,
            owned,
          }),
        )
        return (results[0] as unknown[]).length > 0
      }
      const [removed] = await atomically(db, [
        db
          .delete(tenantFees)
          .where(
            and(
              eq(tenantFees.id, feeId),
              eq(tenantFees.tenancyId, tenancyId),
              ownsTenancy(actorId, propertyId, tenancyId),
              // Only the one period, still the latest.
              exists(
                db
                  .select({ one: sql`1` })
                  .from(tenantFeeAmounts)
                  .where(
                    and(
                      eq(tenantFeeAmounts.tenantFeeId, feeId),
                      eq(tenantFeeAmounts.validFrom, latestStart),
                    ),
                  ),
              ),
              notExists(
                db
                  .select({ one: sql`1` })
                  .from(tenantFeeAmounts)
                  .where(
                    and(
                      eq(tenantFeeAmounts.tenantFeeId, feeId),
                      ne(tenantFeeAmounts.validFrom, latestStart),
                    ),
                  ),
              ),
            ),
          )
          .returning({ id: tenantFees.id }),
      ])
      return removed.length > 0
    },

    /**
     * Sets the tenancy's occupants from `write.from`: a new period, or a
     * correction of the latest. False when nothing applied: the actor isn't
     * an owner, the tenancy isn't the flat's, or the latest period changed
     * since it was read.
     */
    async setOccupants(write: OccupantsWrite): Promise<boolean> {
      const { actorId, propertyId, tenancyId, persons, from } = write
      const results = await atomically(
        db,
        periodWriteStatements(db, occupantsPeriods, {
          parentId: tenancyId,
          value: persons,
          from,
          latestStart: write.latestStart,
          corrects: write.corrects ?? false,
          owned: ownsTenancy(actorId, propertyId, tenancyId),
        }),
      )
      return (results.at(-1) as unknown[]).length > 0
    },

    /**
     * Undoes the tenancy's latest occupants change: deletes the latest
     * period and reopens the previous one. False when nothing applied.
     */
    async undoOccupants(undo: RentUndo): Promise<boolean> {
      const results = await atomically(
        db,
        periodUndoStatements(db, occupantsPeriods, {
          parentId: undo.tenancyId,
          latestStart: undo.latestStart,
          previousStart: undo.previousStart,
          owned: ownsTenancy(undo.actorId, undo.propertyId, undo.tenancyId),
        }),
      )
      return (results[0] as unknown[]).length > 0
    },

    /**
     * Undoes a tenancy's latest rent change: deletes the latest period and
     * reopens the previous one. The first period is never deleted, because
     * the previous one must be there. False when nothing applied.
     */
    async undoLatestRent(undo: RentUndo): Promise<boolean> {
      const { actorId, propertyId, tenancyId, latestStart, previousStart } =
        undo
      const scope = rentsOf(tenancyId)
      const previous = and(
        scope,
        eq(tenancyRents.validFrom, previousStart),
        eq(tenancyRents.validTo, dayBefore(latestStart)),
      )
      const [removed] = await atomically(db, [
        db
          .delete(tenancyRents)
          .where(
            and(
              scope,
              eq(tenancyRents.validFrom, latestStart),
              isNull(tenancyRents.validTo),
              ownsTenancy(actorId, propertyId, tenancyId),
              exists(
                db
                  .select({ one: sql`1` })
                  .from(tenancyRents)
                  .where(previous),
              ),
            ),
          )
          .returning({ id: tenancyRents.id }),
        db
          .update(tenancyRents)
          .set({ validTo: null })
          .where(
            and(
              previous,
              notExists(
                db
                  .select({ one: sql`1` })
                  .from(tenancyRents)
                  .where(and(scope, eq(tenancyRents.validFrom, latestStart))),
              ),
            ),
          ),
      ])
      return removed.length > 0
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
     * Adds a tenancy with its first rent period and its first occupants
     * period from its start, all or none: they go in only if the tenancy row
     * did. `overlaps` also covers a lost owner role.
     */
    async createWithRent(
      actorId: string,
      propertyId: string,
      fields: TenancyFields,
      /** Cents per month. */
      rent: number,
      now: Date,
      /** An ending recorded with the tenancy, for an earlier one. */
      ending?: Ending,
      /** The persons living in the flat from the start; one by default. */
      occupants = 1,
      /** Fees added from the start day, e.g. copied from the previous tenancy. */
      fees: Pick<NewFee, 'kind' | 'basis' | 'description' | 'amount'>[] = [],
    ): Promise<{ outcome: 'created'; id: string } | { outcome: 'overlaps' }> {
      const { id, statement } = createStatement(
        actorId,
        propertyId,
        fields,
        now,
        ending,
      )
      const [inserted] = await atomically(db, [
        statement,
        ...rentStatements({
          actorId,
          propertyId,
          tenancyId: id,
          amount: rent,
          from: fields.validFrom,
          latestStart: null,
        }),
        ...periodWriteStatements(db, occupantsPeriods, {
          parentId: id,
          value: occupants,
          from: fields.validFrom,
          latestStart: null,
          owned: ownsTenancy(actorId, propertyId, id),
        }),
        ...fees.flatMap((fee) =>
          feeStatements(
            {
              ...fee,
              actorId,
              propertyId,
              tenancyId: id,
              from: fields.validFrom,
            },
            crypto.randomUUID(),
          ),
        ),
      ])
      return inserted.length > 0
        ? { outcome: 'created', id }
        : { outcome: 'overlaps' }
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
      change: {
        validTo: IsoDate | null
        expectedValidTo: IsoDate | null
        /** The first rent period's move with a corrected start, or none. */
        firstRent?: { from: IsoDate; to: IsoDate } | null
        /** The first occupants period's move with a corrected start. */
        firstOccupants?: { from: IsoDate; to: IsoDate } | null
        /** Each fee's first amount period's move with a corrected start. */
        firstFees?: { feeId: string; from: IsoDate; to: IsoDate }[]
      },
      now: Date,
    ): Promise<boolean> {
      const move = change.firstRent
      const occupantsMove = change.firstOccupants
      // Only once the tenancy has its new start, i.e. the update applied.
      const hasNewStart = exists(
        db
          .select({ one: sql`1` })
          .from(other)
          .where(
            and(eq(other.id, tenancyId), eq(other.validFrom, fields.validFrom)),
          ),
      )
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
        // Only once the tenancy has its new start, i.e. the update applied.
        ...(move
          ? [
              db
                .update(tenancyRents)
                .set({ validFrom: move.to })
                .where(
                  and(
                    rentsOf(tenancyId),
                    eq(tenancyRents.validFrom, move.from),
                    exists(
                      db
                        .select({ one: sql`1` })
                        .from(other)
                        .where(
                          and(
                            eq(other.id, tenancyId),
                            eq(other.validFrom, fields.validFrom),
                          ),
                        ),
                    ),
                  ),
                ),
            ]
          : []),
        ...(occupantsMove
          ? [
              db
                .update(tenancyOccupants)
                .set({ validFrom: occupantsMove.to })
                .where(
                  and(
                    eq(tenancyOccupants.tenancyId, tenancyId),
                    eq(tenancyOccupants.validFrom, occupantsMove.from),
                    hasNewStart,
                  ),
                ),
            ]
          : []),
        ...(change.firstFees ?? []).map((fee) =>
          db
            .update(tenantFeeAmounts)
            .set({ validFrom: fee.to })
            .where(
              and(
                eq(tenantFeeAmounts.tenantFeeId, fee.feeId),
                eq(tenantFeeAmounts.validFrom, fee.from),
                hasNewStart,
              ),
            ),
        ),
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
