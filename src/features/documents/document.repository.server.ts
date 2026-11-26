// A flat's documents (openspec: documents). Writes carry the owner check, the
// storage quota and the lease's tenancy inside their statements, so a role
// lost or a tenancy removed between the read and the write changes nothing.
// The caller stores and deletes the files; this module returns the key it
// removed.
import { and, count, desc, eq, exists, sql } from 'drizzle-orm'
import type { IsoDate } from '#/lib/dates'
import {
  properties,
  propertyAccess,
  propertyDocuments,
  tenancies,
  user,
  type DocumentKind,
} from '#/server/db/schema'
import { fitsStorageQuota, storageUsage } from '#/server/db/storage-usage'
import { type Db } from '#/server/platform/db.server'

export interface DocumentFields {
  kind: DocumentKind
  name: string
  date: IsoDate
  /** Only a lease has a tenancy; for another kind it is dropped. */
  tenancyId: string | null
}

export interface DocumentFile {
  key: string
  contentType: string
  size: number
  filename: string
}

/** A document in a list. */
export interface DocumentRow {
  id: string
  kind: DocumentKind
  name: string
  date: IsoDate
  contentType: string
  size: number
}

export interface DocumentDetails extends DocumentRow {
  propertyId: string
  tenancyId: string | null
  /** The tenant of the lease's tenancy. */
  tenantName: string | null
  filename: string
  uploadedBy: { id: string; name: string }
  createdAt: Date
}

/** What the file route needs to decide and serve. */
export interface DocumentFileInfo {
  id: string
  propertyId: string
  key: string
  contentType: string
  filename: string
}

const rowColumns = {
  id: propertyDocuments.id,
  kind: propertyDocuments.kind,
  name: propertyDocuments.name,
  date: propertyDocuments.date,
  contentType: propertyDocuments.contentType,
  size: propertyDocuments.size,
}

export function documentRepository(db: Db) {
  /** The actor owns the flat: the check inside each write. */
  const isOwner = (actorId: string, propertyId: unknown) =>
    exists(
      db
        .select({ one: sql`1` })
        .from(propertyAccess)
        .where(
          and(
            sql`${propertyAccess.propertyId} = ${propertyId}`,
            eq(propertyAccess.userId, actorId),
            eq(propertyAccess.role, 'owner'),
          ),
        ),
    )

  /** The tenancy, if any, is one of the flat. */
  const tenancyOfFlat = (tenancyId: string | null, propertyId: unknown) =>
    tenancyId === null
      ? undefined
      : exists(
          db
            .select({ one: sql`1` })
            .from(tenancies)
            .where(
              and(
                eq(tenancies.id, tenancyId),
                sql`${tenancies.propertyId} = ${propertyId}`,
              ),
            ),
        )

  /** Only a lease keeps a tenancy. */
  const leaseTenancy = (fields: DocumentFields) =>
    fields.kind === 'lease' ? fields.tenancyId : null

  return {
    /**
     * Adds a document to a flat the actor owns. Null when they aren't an
     * owner, the tenancy isn't the flat's or the file doesn't fit their
     * storage quota; nothing is written then.
     */
    async add(
      actorId: string,
      propertyId: string,
      fields: DocumentFields,
      file: DocumentFile,
      now: Date,
    ): Promise<string | null> {
      const id = crypto.randomUUID()
      const tenancyId = leaseTenancy(fields)
      const inserted = await db
        .insert(propertyDocuments)
        .select(
          db
            .select({
              id: sql<string>`${id}`.as('id'),
              propertyId: properties.id,
              tenancyId: sql<string | null>`${tenancyId}`.as('tenancy_id'),
              kind: sql<DocumentKind>`${fields.kind}`.as('kind'),
              name: sql<string>`${fields.name}`.as('name'),
              date: sql<string>`${fields.date}`.as('date'),
              key: sql<string>`${file.key}`.as('key'),
              contentType: sql<string>`${file.contentType}`.as('content_type'),
              size: sql<number>`${file.size}`.as('size'),
              filename: sql<string>`${file.filename}`.as('filename'),
              uploadedBy: sql<string>`${actorId}`.as('uploaded_by'),
              createdAt: sql<number>`${now.getTime()}`.as('created_at'),
              updatedAt: sql<number>`${now.getTime()}`.as('updated_at'),
            })
            .from(properties)
            .where(
              and(
                eq(properties.id, propertyId),
                isOwner(actorId, properties.id),
                tenancyOfFlat(tenancyId, properties.id),
                fitsStorageQuota(db, actorId, file.size),
              ),
            ),
        )
        .returning({ id: propertyDocuments.id })
      return inserted.length > 0 ? id : null
    },

    /**
     * Changes a document's kind, name, date and tenancy, never its file.
     * Returns whether it applied: false when the document is gone, the actor
     * doesn't own its flat or the tenancy isn't the flat's.
     */
    async update(
      actorId: string,
      documentId: string,
      fields: DocumentFields,
      now: Date,
    ): Promise<boolean> {
      const tenancyId = leaseTenancy(fields)
      const updated = await db
        .update(propertyDocuments)
        .set({
          kind: fields.kind,
          name: fields.name,
          date: fields.date,
          tenancyId,
          updatedAt: now,
        })
        .where(
          and(
            eq(propertyDocuments.id, documentId),
            isOwner(actorId, propertyDocuments.propertyId),
            tenancyOfFlat(tenancyId, propertyDocuments.propertyId),
          ),
        )
        .returning({ id: propertyDocuments.id })
      return updated.length > 0
    },

    /**
     * Deletes a document of a flat the actor owns. Returns the key of its
     * file, which the caller deletes from storage, or null when nothing was
     * deleted.
     */
    async remove(actorId: string, documentId: string): Promise<string | null> {
      const removed = await db
        .delete(propertyDocuments)
        .where(
          and(
            eq(propertyDocuments.id, documentId),
            isOwner(actorId, propertyDocuments.propertyId),
          ),
        )
        .returning({ key: propertyDocuments.key })
      return removed.length > 0 ? removed[0].key : null
    },

    /** The bytes and number of files the user has uploaded, of any kind. */
    storageUsage(userId: string) {
      return storageUsage(db, userId)
    },

    /** The flat's documents, newest first. */
    listForProperty(propertyId: string): Promise<DocumentRow[]> {
      return db
        .select(rowColumns)
        .from(propertyDocuments)
        .where(eq(propertyDocuments.propertyId, propertyId))
        .orderBy(
          desc(propertyDocuments.date),
          desc(propertyDocuments.createdAt),
        )
    },

    /** The leases naming the tenancy, newest first. */
    leasesOfTenancy(tenancyId: string): Promise<DocumentRow[]> {
      return db
        .select(rowColumns)
        .from(propertyDocuments)
        .where(
          and(
            eq(propertyDocuments.tenancyId, tenancyId),
            eq(propertyDocuments.kind, 'lease'),
          ),
        )
        .orderBy(
          desc(propertyDocuments.date),
          desc(propertyDocuments.createdAt),
        )
    },

    /** The flat's latest documents by date, newest first. */
    latestForProperty(propertyId: string, limit: number) {
      return db
        .select(rowColumns)
        .from(propertyDocuments)
        .where(eq(propertyDocuments.propertyId, propertyId))
        .orderBy(
          desc(propertyDocuments.date),
          desc(propertyDocuments.createdAt),
        )
        .limit(limit)
    },

    async countForProperty(propertyId: string): Promise<number> {
      const [row] = await db
        .select({ count: count() })
        .from(propertyDocuments)
        .where(eq(propertyDocuments.propertyId, propertyId))
      return row.count
    },

    /** Where a document's file is, for the access check and serving. */
    async findForAccess(documentId: string): Promise<DocumentFileInfo | null> {
      const row = await db
        .select({
          id: propertyDocuments.id,
          propertyId: propertyDocuments.propertyId,
          key: propertyDocuments.key,
          contentType: propertyDocuments.contentType,
          filename: propertyDocuments.filename,
        })
        .from(propertyDocuments)
        .where(eq(propertyDocuments.id, documentId))
        .get()
      return row ?? null
    },

    /** A document with who added it and its lease's tenant, or null. */
    async findDetails(documentId: string): Promise<DocumentDetails | null> {
      const row = await db
        .select({
          document: propertyDocuments,
          uploaderName: user.name,
          tenantName: tenancies.tenantName,
        })
        .from(propertyDocuments)
        .innerJoin(user, eq(user.id, propertyDocuments.uploadedBy))
        .leftJoin(tenancies, eq(tenancies.id, propertyDocuments.tenancyId))
        .where(eq(propertyDocuments.id, documentId))
        .get()
      if (!row) {
        return null
      }
      const { document } = row
      return {
        id: document.id,
        propertyId: document.propertyId,
        kind: document.kind,
        name: document.name,
        date: document.date,
        contentType: document.contentType,
        size: document.size,
        tenancyId: document.tenancyId,
        tenantName: row.tenantName,
        filename: document.filename,
        uploadedBy: { id: document.uploadedBy, name: row.uploaderName },
        createdAt: document.createdAt,
      }
    },
  }
}

export type DocumentRepository = ReturnType<typeof documentRepository>
