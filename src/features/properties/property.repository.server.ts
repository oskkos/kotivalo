// Flats and who can reach them (openspec: properties). Every read and write
// goes through the user's access row, so a flat without access looks the
// same as one that doesn't exist.
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { IsoDate } from '#/lib/dates'
import {
  ownershipPeriods,
  properties,
  propertyAccess,
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
}

type Row = Pick<typeof properties.$inferSelect, keyof typeof columns>

const toProperty = (row: Row): Property => ({
  ...row,
  roomCount: row.roomCount as RoomCount,
})

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
        .set({ ...details, updatedAt: now })
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
     * access row. An archived flat keeps its first date. Returns whether the
     * user has access to the flat.
     */
    async setArchived(
      userId: string,
      propertyId: string,
      at: Date | null,
    ): Promise<boolean> {
      const own = and(
        eq(propertyAccess.propertyId, propertyId),
        eq(propertyAccess.userId, userId),
      )
      const found = await db
        .update(propertyAccess)
        .set({ archivedAt: at })
        .where(at === null ? own : and(own, isNull(propertyAccess.archivedAt)))
        .returning({ id: propertyAccess.propertyId })
      if (found.length > 0 || at === null) {
        return found.length > 0
      }
      // Already archived: the first date stays, but the user has access.
      return (
        (await db.$count(
          propertyAccess,
          and(own, isNotNull(propertyAccess.archivedAt)),
        )) > 0
      )
    },

    countForUser(userId: string): Promise<number> {
      return db.$count(propertyAccess, eq(propertyAccess.userId, userId))
    },
  }
}

export type PropertyRepository = ReturnType<typeof propertyRepository>
