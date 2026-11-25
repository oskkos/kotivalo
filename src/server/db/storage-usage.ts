// What a user has stored, across everything they upload: the receipts of
// entries and the documents of flats. One builder so the quota is one total
// (R2's free tier is per account) and the write of each kind checks the same
// sum. Like periods.ts it may use Drizzle: it is plain SQL (a UNION ALL, a
// sum and a count) that works in SQLite and PostgreSQL alike.
import { and, count, eq, ne, sql, sum } from 'drizzle-orm'
import { unionAll } from 'drizzle-orm/sqlite-core'
import { STORAGE_QUOTA, type StorageUsage } from '#/server/files/quota'
import type { Db } from '#/server/platform/db.server'
import { propertyDocuments, receipts } from './schema'

/**
 * The sizes of the files `userId` has uploaded, as a subquery with the column
 * `size`. `replacing` leaves out the receipt of that entry, which a new file
 * is about to replace.
 */
export function uploadedFiles(db: Db, userId: string, replacing?: string) {
  const receiptSizes = db
    .select({ size: receipts.size })
    .from(receipts)
    .where(
      and(
        eq(receipts.uploadedBy, userId),
        replacing === undefined
          ? undefined
          : ne(receipts.transactionId, replacing),
      ),
    )
  const documentSizes = db
    .select({ size: propertyDocuments.size })
    .from(propertyDocuments)
    .where(eq(propertyDocuments.uploadedBy, userId))
  return unionAll(receiptSizes, documentSizes).as('uploaded_files')
}

/**
 * The condition that one more file of `size` bytes fits `userId`'s quota. Put
 * it inside the write, so parallel uploads can't all pass a check made before
 * them.
 */
export function fitsStorageQuota(
  db: Db,
  userId: string,
  size: number,
  replacing?: string,
) {
  const files = uploadedFiles(db, userId, replacing)
  const used = db
    .select({ bytes: sql`coalesce(sum(${files.size}), 0)` })
    .from(files)
  const number = db.select({ files: count() }).from(files)
  return and(
    sql`(${used}) + ${size} <= ${STORAGE_QUOTA.bytes}`,
    sql`(${number}) + 1 <= ${STORAGE_QUOTA.files}`,
  )
}

/** The bytes and number of files the user has uploaded. */
export async function storageUsage(
  db: Db,
  userId: string,
  replacing?: string,
): Promise<StorageUsage> {
  const files = uploadedFiles(db, userId, replacing)
  const [row] = await db
    .select({ bytes: sum(files.size), files: count() })
    .from(files)
  return { bytes: Number(row.bytes ?? 0), files: row.files }
}
