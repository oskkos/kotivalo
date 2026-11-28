// Flats and who can reach them (openspec: properties). Every read and write
// goes through the user's access row, so a flat without access looks the
// same as one that doesn't exist.
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import {
  and,
  asc,
  count,
  eq,
  exists,
  gt,
  inArray,
  isNotNull,
  isNull,
  ne,
  notExists,
} from 'drizzle-orm'
import type { IsoDate } from '#/lib/dates'
import {
  financingCharges,
  financingTreatments,
  ownershipPeriods,
  properties,
  propertyAccess,
  propertyDocuments,
  receipts,
  recurringAmounts,
  rentPayments,
  tenancies,
  transactions,
  usageCharges,
  user,
  type PropertyRole,
} from '#/server/db/schema'
import { atomically, type Db } from '#/server/platform/db.server'
import type {
  Property,
  PropertyDetails,
  RoomCount,
  UserProperty,
} from './property'

const columns = {
  id: properties.id,
  streetAddress: properties.streetAddress,
  postcode: properties.postcode,
  city: properties.city,
  roomCount: properties.roomCount,
  floorArea: properties.floorArea,
  housingCompanyName: properties.housingCompanyName,
  businessId: properties.businessId,
  apartmentNumber: properties.apartmentNumber,
}

type Row = Pick<typeof properties.$inferSelect, keyof typeof columns>

const toProperty = (row: Row): Property => {
  const { housingCompanyName, businessId, apartmentNumber, ...rest } = row
  return {
    ...rest,
    roomCount: row.roomCount as RoomCount,
    ...(housingCompanyName !== null && { housingCompanyName }),
    ...(businessId !== null && { businessId }),
    ...(apartmentNumber !== null && { apartmentNumber }),
  }
}

/** The housing company details as columns: missing is null. */
const housingCompanyValues = (details: PropertyDetails) => ({
  housingCompanyName: details.housingCompanyName ?? null,
  businessId: details.businessId ?? null,
  apartmentNumber: details.apartmentNumber ?? null,
})

/** What deleting a flat removes, for the confirmation. */
export interface DeletionSummary {
  /** A tenancy, charge, financing charge, treatment, usage charge or entry. */
  hasData: boolean
  counts: {
    tenancies: number
    rentPayments: number
    transactions: number
    receipts: number
    documents: number
  }
  /** The members, who lose their access. */
  members: string[]
}

export function propertyRepository(db: Db) {
  /** The ids of the flats the user has access to, as a subquery. */
  const accessible = (userId: string) =>
    db
      .select({ id: propertyAccess.propertyId })
      .from(propertyAccess)
      .where(eq(propertyAccess.userId, userId))

  const listWhere = async (
    userId: string,
    archived: ReturnType<typeof isNull>,
  ): Promise<Property[]> => {
    const rows = await db
      .select(columns)
      .from(properties)
      .innerJoin(
        propertyAccess,
        and(
          eq(propertyAccess.propertyId, properties.id),
          eq(propertyAccess.userId, userId),
          archived,
        ),
      )
    return rows.map(toProperty)
  }

  return {
    /**
     * Adds a flat with the user as its owner, owning 100 % from `ownedSince`
     * (openspec: ownership, "The first ownership period").
     */
    async create(
      userId: string,
      details: PropertyDetails,
      now: Date,
      ownedSince: IsoDate,
    ): Promise<Property> {
      const id = crypto.randomUUID()
      await atomically(db, [
        db.insert(properties).values({
          id,
          ...details,
          ...housingCompanyValues(details),
          createdAt: now,
          updatedAt: now,
        }),
        db
          .insert(propertyAccess)
          .values({ propertyId: id, userId, role: 'owner', createdAt: now }),
        db.insert(ownershipPeriods).values({
          id: crypto.randomUUID(),
          propertyId: id,
          userId,
          share: 10000,
          validFrom: ownedSince,
          validTo: null,
          reason: null,
        }),
      ])
      return { id, ...details }
    },

    /**
     * Changes a flat's details if the user has access to it. The access is
     * checked in the same statement. Returns whether a flat was changed.
     */
    async update(
      userId: string,
      id: string,
      details: PropertyDetails,
      now: Date,
    ): Promise<boolean> {
      const changed = await db
        .update(properties)
        .set({ ...details, ...housingCompanyValues(details), updatedAt: now })
        .where(
          and(
            eq(properties.id, id),
            inArray(properties.id, accessible(userId)),
          ),
        )
        .returning({ id: properties.id })
      return changed.length > 0
    },

    async findForUser(
      userId: string,
      id: string,
    ): Promise<UserProperty | undefined> {
      const row = await db
        .select({ ...columns, archivedAt: propertyAccess.archivedAt })
        .from(properties)
        .innerJoin(
          propertyAccess,
          and(
            eq(propertyAccess.propertyId, properties.id),
            eq(propertyAccess.userId, userId),
          ),
        )
        .where(eq(properties.id, id))
        .get()
      return row === undefined
        ? undefined
        : { ...toProperty(row), archivedAt: row.archivedAt }
    },

    /**
     * The flats the user hasn't archived. Unsorted: sort for display with
     * sortByStreetAddress(). The list, the rent summary and the new entry
     * options all read through this, so an archived flat is left out of all.
     */
    async listForUser(userId: string): Promise<Property[]> {
      return listWhere(userId, isNull(propertyAccess.archivedAt))
    },

    /**
     * The flats the user has no access to but had a share above 0 in on some
     * day (openspec: year-summary, "A former owner's year summary"). Only the
     * year summary reads these; every other access check stays on the access
     * row. Unsorted.
     */
    async listFormerlyOwnedForUser(userId: string): Promise<Property[]> {
      const rows = await db
        .selectDistinct(columns)
        .from(properties)
        .innerJoin(
          ownershipPeriods,
          and(
            eq(ownershipPeriods.propertyId, properties.id),
            eq(ownershipPeriods.userId, userId),
            gt(ownershipPeriods.share, 0),
          ),
        )
        .where(
          notExists(
            db
              .select({ one: propertyAccess.userId })
              .from(propertyAccess)
              .where(
                and(
                  eq(propertyAccess.propertyId, properties.id),
                  eq(propertyAccess.userId, userId),
                ),
              ),
          ),
        )
      return rows.map(toProperty)
    },

    /** The flats the user has archived, with when. Unsorted. */
    async listArchivedForUser(userId: string): Promise<UserProperty[]> {
      const rows = await db
        .select({ ...columns, archivedAt: propertyAccess.archivedAt })
        .from(properties)
        .innerJoin(
          propertyAccess,
          and(
            eq(propertyAccess.propertyId, properties.id),
            eq(propertyAccess.userId, userId),
            isNotNull(propertyAccess.archivedAt),
          ),
        )
      return rows.map((row) => ({
        ...toProperty(row),
        archivedAt: row.archivedAt,
      }))
    },

    /**
     * Archives (`at`) or restores (`null`) the flat for the user, on their own
     * access row. An archived flat keeps its first date. Returns whether it
     * changed, was already so (`unchanged`), or the user has no access.
     */
    async setArchived(
      userId: string,
      propertyId: string,
      at: Date | null,
    ): Promise<'changed' | 'unchanged' | 'not_found'> {
      const own = and(
        eq(propertyAccess.propertyId, propertyId),
        eq(propertyAccess.userId, userId),
      )
      const changed = await db
        .update(propertyAccess)
        .set({ archivedAt: at })
        .where(
          and(
            own,
            at === null
              ? isNotNull(propertyAccess.archivedAt)
              : isNull(propertyAccess.archivedAt),
          ),
        )
        .returning({ id: propertyAccess.propertyId })
      if (changed.length > 0) {
        return 'changed'
      }
      return (await db.$count(propertyAccess, own)) > 0
        ? 'unchanged'
        : 'not_found'
    },

    /**
     * The user's role in the flat (undefined without access) and the names of
     * everyone else who has had a share above 0 % in any ownership period.
     */
    async deletionCheck(
      userId: string,
      propertyId: string,
    ): Promise<{ role: PropertyRole | undefined; otherOwners: string[] }> {
      const access = await db
        .select({ role: propertyAccess.role })
        .from(propertyAccess)
        .where(
          and(
            eq(propertyAccess.propertyId, propertyId),
            eq(propertyAccess.userId, userId),
          ),
        )
        .get()
      const others = await db
        .selectDistinct({ name: user.name })
        .from(ownershipPeriods)
        .innerJoin(user, eq(user.id, ownershipPeriods.userId))
        .where(
          and(
            eq(ownershipPeriods.propertyId, propertyId),
            ne(ownershipPeriods.userId, userId),
            gt(ownershipPeriods.share, 0),
          ),
        )
        .orderBy(asc(user.name))
      return {
        role: access?.role,
        otherOwners: others.map((other) => other.name),
      }
    },

    async deletionSummary(propertyId: string): Promise<DeletionSummary> {
      const total = async (query: Promise<{ n: number }[]>): Promise<number> =>
        (await query)[0]?.n ?? 0
      const ofFlat = (table: { propertyId: AnySQLiteColumn }) =>
        eq(table.propertyId, propertyId)
      const counts = {
        tenancies: await db.$count(tenancies, ofFlat(tenancies)),
        rentPayments: await total(
          db
            .select({ n: count() })
            .from(rentPayments)
            .innerJoin(tenancies, eq(tenancies.id, rentPayments.tenancyId))
            .where(eq(tenancies.propertyId, propertyId)),
        ),
        transactions: await db.$count(transactions, ofFlat(transactions)),
        receipts: await total(
          db
            .select({ n: count() })
            .from(receipts)
            .innerJoin(
              transactions,
              eq(transactions.id, receipts.transactionId),
            )
            .where(eq(transactions.propertyId, propertyId)),
        ),
        documents: await db.$count(
          propertyDocuments,
          ofFlat(propertyDocuments),
        ),
      }
      const others =
        (await db.$count(recurringAmounts, ofFlat(recurringAmounts))) +
        (await db.$count(financingCharges, ofFlat(financingCharges))) +
        (await db.$count(financingTreatments, ofFlat(financingTreatments))) +
        (await db.$count(usageCharges, ofFlat(usageCharges)))
      const members = await db
        .select({ name: user.name })
        .from(propertyAccess)
        .innerJoin(user, eq(user.id, propertyAccess.userId))
        .where(
          and(
            eq(propertyAccess.propertyId, propertyId),
            eq(propertyAccess.role, 'member'),
          ),
        )
        .orderBy(asc(user.name))
      return {
        hasData:
          counts.tenancies + counts.transactions + counts.documents + others >
          0,
        counts,
        members: members.map((member) => member.name),
      }
    },

    /** The storage keys of every receipt and document file of the flat. */
    async fileKeys(propertyId: string): Promise<string[]> {
      const receiptRows = await db
        .select({ key: receipts.key })
        .from(receipts)
        .innerJoin(transactions, eq(transactions.id, receipts.transactionId))
        .where(eq(transactions.propertyId, propertyId))
      const documentRows = await db
        .select({ key: propertyDocuments.key })
        .from(propertyDocuments)
        .where(eq(propertyDocuments.propertyId, propertyId))
      return [...receiptRows, ...documentRows].map((row) => row.key)
    },

    /**
     * Deletes the flat and, through ON DELETE CASCADE, everything recorded
     * for it, in one statement: only when the user is an owner and nobody
     * else has had a share above 0 % (so the rule holds even if ownership
     * changed since it was checked). Returns whether the flat was deleted.
     */
    async deleteGuarded(userId: string, propertyId: string): Promise<boolean> {
      const deleted = await db
        .delete(properties)
        .where(
          and(
            eq(properties.id, propertyId),
            exists(
              db
                .select({ one: propertyAccess.userId })
                .from(propertyAccess)
                .where(
                  and(
                    eq(propertyAccess.propertyId, propertyId),
                    eq(propertyAccess.userId, userId),
                    eq(propertyAccess.role, 'owner'),
                  ),
                ),
            ),
            notExists(
              db
                .select({ one: ownershipPeriods.id })
                .from(ownershipPeriods)
                .where(
                  and(
                    eq(ownershipPeriods.propertyId, propertyId),
                    ne(ownershipPeriods.userId, userId),
                    gt(ownershipPeriods.share, 0),
                  ),
                ),
            ),
          ),
        )
        .returning({ id: properties.id })
      return deleted.length > 0
    },

    countForUser(userId: string): Promise<number> {
      return db.$count(propertyAccess, eq(propertyAccess.userId, userId))
    },
  }
}

export type PropertyRepository = ReturnType<typeof propertyRepository>
