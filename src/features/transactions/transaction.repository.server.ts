// A flat's entries and their receipts (openspec: transactions). Writes run in
// one atomically() batch and carry the owner check in their statements, so a
// role lost between the read and the write changes nothing. The caller stores
// and deletes the receipt files; this module returns the keys it removed.
import {
  and,
  count,
  desc,
  eq,
  exists,
  gte,
  lte,
  ne,
  sql,
  sum,
} from 'drizzle-orm'
import type { IsoDate } from '#/lib/dates'
import {
  properties,
  propertyAccess,
  receipts,
  transactions,
  user,
  type TransactionCategory,
  type TransactionType,
} from '#/server/db/schema'
import { STORAGE_QUOTA } from '#/server/files/quota'
import { atomically, type Db } from '#/server/platform/db.server'

export interface TransactionFields {
  type: TransactionType
  category: TransactionCategory
  /** Positive, in cents. */
  amount: number
  date: IsoDate
  note: string | null
}

export interface ReceiptFields {
  key: string
  contentType: string
  size: number
  filename: string
}

export interface TransactionRow extends TransactionFields {
  id: string
  hasReceipt: boolean
}

export interface Receipt {
  id: string
  contentType: string
  size: number
  filename: string
  createdAt: Date
}

export interface TransactionDetails extends TransactionFields {
  id: string
  propertyId: string
  createdBy: { id: string; name: string }
  createdAt: Date
  receipt: Receipt | null
}

/** What happens to an entry's receipt in an update. */
export type ReceiptChange =
  | { kind: 'keep' }
  | { kind: 'remove' }
  | { kind: 'replace'; receipt: ReceiptFields }

export function transactionRepository(db: Db) {
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

  /** The entry belongs to the flat and the actor owns it. */
  const ownedEntry = (actorId: string, propertyId: string, id: string) =>
    and(
      eq(transactions.id, id),
      eq(transactions.propertyId, propertyId),
      isOwner(actorId, propertyId),
    )

  /**
   * One more file of `size` bytes fits the actor's storage quota, not
   * counting the receipt of `replacing`. Inside the write, so parallel
   * uploads can't all pass a check made before them.
   */
  const fitsQuota = (actorId: string, size: number, replacing?: string) => {
    const own = and(
      eq(receipts.uploadedBy, actorId),
      replacing === undefined
        ? undefined
        : ne(receipts.transactionId, replacing),
    )
    const used = db
      .select({ bytes: sql`coalesce(sum(${receipts.size}), 0)` })
      .from(receipts)
      .where(own)
    const files = db.select({ files: count() }).from(receipts).where(own)
    return and(
      sql`(${used}) + ${size} <= ${STORAGE_QUOTA.bytes}`,
      sql`(${files}) + 1 <= ${STORAGE_QUOTA.files}`,
    )
  }

  /** Inserts a receipt for an entry that exists in the actor's flat. */
  const insertReceipt = (
    actorId: string,
    propertyId: string,
    transactionId: string,
    receipt: ReceiptFields,
    now: Date,
  ) =>
    db.insert(receipts).select(
      db
        .select({
          id: sql<string>`${crypto.randomUUID()}`.as('id'),
          transactionId: transactions.id,
          key: sql<string>`${receipt.key}`.as('key'),
          contentType: sql<string>`${receipt.contentType}`.as('content_type'),
          size: sql<number>`${receipt.size}`.as('size'),
          filename: sql<string>`${receipt.filename}`.as('filename'),
          uploadedBy: sql<string>`${actorId}`.as('uploaded_by'),
          createdAt: sql<number>`${now.getTime()}`.as('created_at'),
        })
        .from(transactions)
        .where(
          and(
            ownedEntry(actorId, propertyId, transactionId),
            fitsQuota(actorId, receipt.size, transactionId),
          ),
        ),
    )

  return {
    /** The year's entries, newest first. */
    async forPropertyYear(
      propertyId: string,
      year: number,
    ): Promise<TransactionRow[]> {
      const rows = await db
        .select({
          id: transactions.id,
          type: transactions.type,
          category: transactions.category,
          amount: transactions.amount,
          date: transactions.date,
          note: transactions.note,
          receiptId: receipts.id,
        })
        .from(transactions)
        .leftJoin(receipts, eq(receipts.transactionId, transactions.id))
        .where(
          and(
            eq(transactions.propertyId, propertyId),
            gte(transactions.date, `${String(year)}-01-01`),
            lte(transactions.date, `${String(year)}-12-31`),
          ),
        )
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
      return rows.map(({ receiptId, ...row }) => ({
        ...row,
        hasReceipt: receiptId !== null,
      }))
    },

    /** The flat's latest entries by date, newest first. */
    async latest(propertyId: string, limit: number): Promise<TransactionRow[]> {
      const rows = await db
        .select({
          id: transactions.id,
          type: transactions.type,
          category: transactions.category,
          amount: transactions.amount,
          date: transactions.date,
          note: transactions.note,
          receiptId: receipts.id,
        })
        .from(transactions)
        .leftJoin(receipts, eq(receipts.transactionId, transactions.id))
        .where(eq(transactions.propertyId, propertyId))
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
        .limit(limit)
      return rows.map(({ receiptId, ...row }) => ({
        ...row,
        hasReceipt: receiptId !== null,
      }))
    },

    /**
     * How many entries of `category` the flat has dated on or after `from`,
     * and their total in cents (openspec: "Water charge entries are warned
     * about").
     */
    async categoryTotalSince(
      propertyId: string,
      category: TransactionCategory,
      from: IsoDate,
    ): Promise<{ count: number; total: number }> {
      const [row] = await db
        .select({ count: count(), total: sum(transactions.amount) })
        .from(transactions)
        .where(
          and(
            eq(transactions.propertyId, propertyId),
            eq(transactions.category, category),
            gte(transactions.date, from),
          ),
        )
      return { count: row.count, total: Number(row.total ?? 0) }
    },

    /** The years that have entries, newest first. */
    async years(propertyId: string): Promise<number[]> {
      const rows = await db
        .selectDistinct({ date: transactions.date })
        .from(transactions)
        .where(eq(transactions.propertyId, propertyId))
      const years = new Set(rows.map((row) => Number(row.date.slice(0, 4))))
      return [...years].sort((a, b) => b - a)
    },

    /** An entry with its author and receipt, or null. */
    async get(transactionId: string): Promise<TransactionDetails | null> {
      const row = await db
        .select({
          entry: transactions,
          authorName: user.name,
          receipt: receipts,
        })
        .from(transactions)
        .innerJoin(user, eq(user.id, transactions.createdBy))
        .leftJoin(receipts, eq(receipts.transactionId, transactions.id))
        .where(eq(transactions.id, transactionId))
        .get()
      if (!row) {
        return null
      }
      const { entry, receipt } = row
      return {
        id: entry.id,
        propertyId: entry.propertyId,
        type: entry.type,
        category: entry.category,
        amount: entry.amount,
        date: entry.date,
        note: entry.note,
        createdBy: { id: entry.createdBy, name: row.authorName },
        createdAt: entry.createdAt,
        receipt: receipt
          ? {
              id: receipt.id,
              contentType: receipt.contentType,
              size: receipt.size,
              filename: receipt.filename,
              createdAt: receipt.createdAt,
            }
          : null,
      }
    },

    /**
     * Logs an entry, with its receipt. Null when the actor isn't an owner or
     * the receipt doesn't fit their storage quota; nothing is written then.
     */
    async create(
      actorId: string,
      propertyId: string,
      fields: TransactionFields,
      receipt: ReceiptFields | null,
      now: Date,
    ): Promise<string | null> {
      const id = crypto.randomUUID()
      const insert = db
        .insert(transactions)
        .select(
          db
            .select({
              id: sql<string>`${id}`.as('id'),
              propertyId: properties.id,
              type: sql<TransactionType>`${fields.type}`.as('type'),
              category: sql<TransactionCategory>`${fields.category}`.as(
                'category',
              ),
              amount: sql<number>`${fields.amount}`.as('amount'),
              date: sql<string>`${fields.date}`.as('date'),
              note: sql<string | null>`${fields.note}`.as('note'),
              createdBy: sql<string>`${actorId}`.as('created_by'),
              createdAt: sql<number>`${now.getTime()}`.as('created_at'),
              updatedAt: sql<number>`${now.getTime()}`.as('updated_at'),
            })
            .from(properties)
            .where(
              and(
                eq(properties.id, propertyId),
                isOwner(actorId, propertyId),
                receipt ? fitsQuota(actorId, receipt.size) : undefined,
              ),
            ),
        )
        .returning({ id: transactions.id })
      if (!receipt) {
        const [inserted] = await atomically(db, [insert])
        return inserted.length > 0 ? id : null
      }
      const [inserted] = await atomically(db, [
        insert,
        insertReceipt(actorId, propertyId, id, receipt, now),
      ])
      return inserted.length > 0 ? id : null
    },

    /**
     * Updates an entry of the flat and its receipt; a replacement that
     * doesn't fit the storage quota changes nothing. Returns whether it
     * applied and the keys of the receipt files it removed, which the caller
     * deletes from storage.
     */
    async update(
      actorId: string,
      propertyId: string,
      transactionId: string,
      fields: TransactionFields,
      change: ReceiptChange,
      now: Date,
    ): Promise<{ applied: boolean; removedKeys: string[] }> {
      // A replacement must fit the quota, or nothing changes.
      const fits =
        change.kind === 'replace'
          ? fitsQuota(actorId, change.receipt.size, transactionId)
          : undefined
      const update = db
        .update(transactions)
        .set({ ...fields, updatedAt: now })
        .where(and(ownedEntry(actorId, propertyId, transactionId), fits))
        .returning({ id: transactions.id })
      if (change.kind === 'keep') {
        const [updated] = await atomically(db, [update])
        return { applied: updated.length > 0, removedKeys: [] }
      }
      const remove = db
        .delete(receipts)
        .where(
          and(
            eq(receipts.transactionId, transactionId),
            exists(
              db
                .select({ one: sql`1` })
                .from(transactions)
                .where(ownedEntry(actorId, propertyId, transactionId)),
            ),
            fits,
          ),
        )
        .returning({ key: receipts.key })
      if (change.kind === 'remove') {
        const [updated, removed] = await atomically(db, [update, remove])
        return {
          applied: updated.length > 0,
          removedKeys: removed.map((row) => row.key),
        }
      }
      const [updated, removed] = await atomically(db, [
        update,
        remove,
        insertReceipt(actorId, propertyId, transactionId, change.receipt, now),
      ])
      return {
        applied: updated.length > 0,
        removedKeys: removed.map((row) => row.key),
      }
    },

    /** Deletes an entry of the flat; returns whether it applied and its file. */
    async delete(
      actorId: string,
      propertyId: string,
      transactionId: string,
    ): Promise<{ applied: boolean; removedKeys: string[] }> {
      const [removed, deleted] = await atomically(db, [
        db
          .delete(receipts)
          .where(
            and(
              eq(receipts.transactionId, transactionId),
              exists(
                db
                  .select({ one: sql`1` })
                  .from(transactions)
                  .where(ownedEntry(actorId, propertyId, transactionId)),
              ),
            ),
          )
          .returning({ key: receipts.key }),
        db
          .delete(transactions)
          .where(ownedEntry(actorId, propertyId, transactionId))
          .returning({ id: transactions.id }),
      ])
      return {
        applied: deleted.length > 0,
        removedKeys: removed.map((row) => row.key),
      }
    },

    /** A receipt with its file key and its entry's flat, for serving it. */
    async receiptForAccess(
      receiptId: string,
    ): Promise<
      | (Receipt & { key: string; propertyId: string; transactionId: string })
      | null
    > {
      const row = await db
        .select({
          receipt: receipts,
          propertyId: transactions.propertyId,
        })
        .from(receipts)
        .innerJoin(transactions, eq(transactions.id, receipts.transactionId))
        .where(eq(receipts.id, receiptId))
        .get()
      if (!row) {
        return null
      }
      const { receipt } = row
      return {
        id: receipt.id,
        key: receipt.key,
        contentType: receipt.contentType,
        size: receipt.size,
        filename: receipt.filename,
        createdAt: receipt.createdAt,
        transactionId: receipt.transactionId,
        propertyId: row.propertyId,
      }
    },

    /** The bytes and number of receipt files the user has uploaded. */
    /** The user's stored receipts, not counting the receipt of `replacing`. */
    async storageUsage(
      userId: string,
      replacing?: string,
    ): Promise<{ bytes: number; files: number }> {
      const [row] = await db
        .select({ bytes: sum(receipts.size), files: count() })
        .from(receipts)
        .where(
          and(
            eq(receipts.uploadedBy, userId),
            replacing === undefined
              ? undefined
              : ne(receipts.transactionId, replacing),
          ),
        )
      return { bytes: Number(row.bytes ?? 0), files: row.files }
    },
  }
}

export type TransactionRepository = ReturnType<typeof transactionRepository>
