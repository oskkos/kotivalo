// Entries and their receipts: the logic behind the server functions in
// functions.ts, with its dependencies passed in so Workers tests can drive it
// (openspec: transactions). A receipt is checked and stored before the
// database write and deleted again if that write doesn't apply, so a refused
// or failed save leaves no file behind (design.md, "The receipt is uploaded
// with the save").
import type { OwnershipRepository } from '#/features/ownership/ownership.repository.server'
import type { Property } from '#/features/properties/property'
import type { PropertyRepository } from '#/features/properties/property.repository.server'
import type { SharingRepository } from '#/features/sharing/sharing.repository.server'
import { isoDateInFinland, type IsoDate } from '#/lib/dates'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import type { PropertyRole } from '#/server/db/schema'
import { fitsQuota } from '#/server/files/quota'
import { newFileKey, type FileStorage } from '#/server/files/storage'
import { checkUpload, UploadError } from '#/server/files/upload'
import type { Logger } from '#/server/log/log'
import { validateTransactionDate } from './rules'
import type {
  ReceiptFields,
  TransactionDetails,
  TransactionFields,
  TransactionRepository,
  TransactionRow,
} from './transaction.repository.server'

export interface TransactionDeps {
  /** The signed-in user. */
  userId: string
  transactions: TransactionRepository
  properties: PropertyRepository
  ownership: OwnershipRepository
  sharing: SharingRepository
  storage: FileStorage
  log: Logger
  now: () => Date
}

/** A receipt file as it arrived. */
export interface Upload {
  bytes: Uint8Array
  /** The browser's file name. */
  filename: string
}

export type ReceiptUpdate =
  | { action: 'keep' }
  | { action: 'remove' }
  | { action: 'replace'; upload: Upload }

interface Failure<R extends FieldReason | AlertReason = AlertReason> {
  ok: false
  reason: R
}

const notFound = {
  ok: false,
  reason: 'property_not_found',
} as const satisfies Failure
const ownerOnly = {
  ok: false,
  reason: 'sharing_owner_only',
} as const satisfies Failure
const entryNotFound = {
  ok: false,
  reason: 'transaction_not_found',
} as const satisfies Failure

/** The longest stored file name, in characters. */
const MAX_FILENAME_LENGTH = 100

/** The browser's file name without control characters, at most 100 long. */
export function receiptFilename(name: string, contentType: string): string {
  const cleaned = name
    .replace(/\p{Cc}/gu, '')
    .trim()
    .slice(-MAX_FILENAME_LENGTH)
  if (cleaned !== '') {
    return cleaned
  }
  const extension = contentType === 'application/pdf' ? 'pdf' : 'jpg'
  return `receipt.${extension}`
}

async function roleCheck(
  deps: TransactionDeps,
  propertyId: string,
): Promise<typeof notFound | typeof ownerOnly | undefined> {
  const role = await deps.sharing.roleOf(deps.userId, propertyId)
  if (!role) {
    return notFound
  }
  return role === 'owner' ? undefined : ownerOnly
}

async function ownershipStart(
  deps: TransactionDeps,
  propertyId: string,
): Promise<IsoDate | undefined> {
  const { periods } = await deps.ownership.history(propertyId)
  return periods.at(-1)?.validFrom
}

async function dateProblem(
  deps: TransactionDeps,
  propertyId: string,
  date: IsoDate,
): Promise<Failure<FieldReason> | undefined> {
  const start = await ownershipStart(deps, propertyId)
  const problem = validateTransactionDate(date, {
    today: isoDateInFinland(deps.now()),
    ownershipStart: start ?? date,
  })
  return problem ? { ok: false, reason: problem } : undefined
}

/**
 * Checks and stores a receipt file. Returns its fields, or why it was
 * refused; nothing is stored then.
 */
async function storeReceipt(
  deps: TransactionDeps,
  propertyId: string,
  upload: Upload,
): Promise<
  { ok: true; receipt: ReceiptFields } | Failure<FieldReason | AlertReason>
> {
  let checked: ReturnType<typeof checkUpload>
  try {
    checked = checkUpload(upload.bytes)
  } catch (error) {
    if (!(error instanceof UploadError)) {
      throw error
    }
    deps.log.warn('receipt.refused', { propertyId, problem: error.problem })
    return {
      ok: false,
      reason:
        error.problem === 'too_large'
          ? 'receipt_too_large'
          : 'receipt_unsupported_type',
    }
  }
  // A first check, so a full quota stores no file; the write checks again.
  const usage = await deps.transactions.storageUsage(deps.userId)
  if (!fitsQuota(usage, checked.size)) {
    return quotaFull(deps, propertyId)
  }
  const key = newFileKey('receipts')
  await deps.storage.put(key, upload.bytes, checked.contentType)
  return {
    ok: true,
    receipt: {
      key,
      contentType: checked.contentType,
      size: checked.size,
      filename: receiptFilename(upload.filename, checked.contentType),
    },
  }
}

function quotaFull(
  deps: TransactionDeps,
  propertyId: string,
): Failure<'storage_quota_full'> {
  deps.log.warn('transaction.quota_exceeded', { propertyId })
  return { ok: false, reason: 'storage_quota_full' }
}

/** Deletes stored files; a failure leaves an orphan and is logged. */
async function deleteFiles(
  deps: TransactionDeps,
  keys: readonly string[],
): Promise<void> {
  for (const key of keys) {
    try {
      await deps.storage.delete(key)
    } catch (error) {
      deps.log.error('receipt.delete_failed', { key }, error)
    }
  }
}

/** Runs a database write after storing a file; removes the file if it fails. */
async function withStoredFile<T>(
  deps: TransactionDeps,
  key: string | undefined,
  write: () => Promise<T>,
  applied: (result: T) => boolean,
): Promise<T> {
  let result: T
  try {
    result = await write()
  } catch (error) {
    if (key) {
      await deleteFiles(deps, [key])
    }
    throw error
  }
  if (key && !applied(result)) {
    await deleteFiles(deps, [key])
  }
  return result
}

export interface TransactionsView {
  role: PropertyRole
  property: Property
  year: number
  /** The current year and the years with entries, newest first. */
  years: number[]
  /** The year's entries, newest first. */
  entries: TransactionRow[]
  /** In cents. */
  totals: { income: number; expense: number }
}

/** Sums a year's entries by type. */
export function totalsOf(
  entries: readonly Pick<TransactionRow, 'type' | 'amount'>[],
): TransactionsView['totals'] {
  const totals = { income: 0, expense: 0 }
  for (const entry of entries) {
    totals[entry.type] += entry.amount
  }
  return totals
}

export async function getTransactions(
  deps: TransactionDeps,
  propertyId: string,
  requestedYear: number | undefined,
): Promise<({ ok: true } & TransactionsView) | typeof notFound> {
  const [role, property] = await Promise.all([
    deps.sharing.roleOf(deps.userId, propertyId),
    deps.properties.findForUser(deps.userId, propertyId),
  ])
  if (!role || !property) {
    return notFound
  }
  const currentYear = Number(isoDateInFinland(deps.now()).slice(0, 4))
  const year = requestedYear ?? currentYear
  const [entries, withEntries] = await Promise.all([
    deps.transactions.forPropertyYear(propertyId, year),
    deps.transactions.years(propertyId),
  ])
  const years = [...new Set([currentYear, ...withEntries])].sort(
    (a, b) => b - a,
  )
  return {
    ok: true,
    role,
    property,
    year,
    years,
    entries,
    totals: totalsOf(entries),
  }
}

export async function getTransaction(
  deps: TransactionDeps,
  propertyId: string,
  transactionId: string,
): Promise<
  | {
      ok: true
      role: PropertyRole
      property: Property
      entry: TransactionDetails
      /** Today in Finland, for the edit form's date check. */
      today: IsoDate
    }
  | typeof notFound
  | typeof entryNotFound
> {
  const [role, property, entry] = await Promise.all([
    deps.sharing.roleOf(deps.userId, propertyId),
    deps.properties.findForUser(deps.userId, propertyId),
    deps.transactions.get(transactionId),
  ])
  if (!role || !property) {
    return notFound
  }
  if (entry?.propertyId !== propertyId) {
    return entryNotFound
  }
  return {
    ok: true,
    role,
    property,
    entry,
    today: isoDateInFinland(deps.now()),
  }
}

/** The flats the user may log entries for, and whether they have any. */
export async function getNewTransactionOptions(deps: TransactionDeps): Promise<{
  ok: true
  /** Owned flats, unsorted: the page sorts them in the user's language. */
  owned: Property[]
  hasFlats: boolean
  today: IsoDate
}> {
  const flats = await deps.properties.listForUser(deps.userId)
  const roles = await Promise.all(
    flats.map((flat) => deps.sharing.roleOf(deps.userId, flat.id)),
  )
  return {
    ok: true,
    owned: flats.filter((_, i) => roles[i] === 'owner'),
    hasFlats: flats.length > 0,
    today: isoDateInFinland(deps.now()),
  }
}

export async function createTransaction(
  deps: TransactionDeps,
  propertyId: string,
  fields: TransactionFields,
  upload: Upload | null,
): Promise<
  { ok: true; transactionId: string } | Failure<FieldReason | AlertReason>
> {
  const refused =
    (await roleCheck(deps, propertyId)) ??
    (await dateProblem(deps, propertyId, fields.date))
  if (refused) {
    return refused
  }
  let receipt: ReceiptFields | null = null
  if (upload) {
    const stored = await storeReceipt(deps, propertyId, upload)
    if (!stored.ok) {
      return stored
    }
    receipt = stored.receipt
  }
  const id = await withStoredFile(
    deps,
    receipt?.key,
    () =>
      deps.transactions.create(
        deps.userId,
        propertyId,
        fields,
        receipt,
        deps.now(),
      ),
    (created) => created !== null,
  )
  if (id === null) {
    return receipt && (await roleCheck(deps, propertyId)) === undefined
      ? quotaFull(deps, propertyId)
      : ownerOnly
  }
  deps.log.info('transaction.created', {
    propertyId,
    transactionId: id,
    type: fields.type,
    category: fields.category,
    hasReceipt: receipt !== null,
  })
  return { ok: true, transactionId: id }
}

export async function updateTransaction(
  deps: TransactionDeps,
  propertyId: string,
  transactionId: string,
  fields: TransactionFields,
  update: ReceiptUpdate,
): Promise<{ ok: true } | Failure<FieldReason | AlertReason>> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const existing = await deps.transactions.get(transactionId)
  if (existing?.propertyId !== propertyId) {
    return entryNotFound
  }
  const problem = await dateProblem(deps, propertyId, fields.date)
  if (problem) {
    return problem
  }
  let receipt: ReceiptFields | undefined
  if (update.action === 'replace') {
    const stored = await storeReceipt(deps, propertyId, update.upload)
    if (!stored.ok) {
      return stored
    }
    receipt = stored.receipt
  }
  const result = await withStoredFile(
    deps,
    receipt?.key,
    () =>
      deps.transactions.update(
        deps.userId,
        propertyId,
        transactionId,
        fields,
        receipt
          ? { kind: 'replace', receipt }
          : update.action === 'remove'
            ? { kind: 'remove' }
            : { kind: 'keep' },
        deps.now(),
      ),
    (updated) => updated.applied,
  )
  if (!result.applied) {
    const stillThere =
      receipt !== undefined &&
      (await roleCheck(deps, propertyId)) === undefined &&
      (await deps.transactions.get(transactionId))?.propertyId === propertyId
    return stillThere ? quotaFull(deps, propertyId) : entryNotFound
  }
  await deleteFiles(deps, result.removedKeys)
  const hadReceipt = existing.receipt !== null
  deps.log.info('transaction.updated', {
    propertyId,
    transactionId,
    receiptChange:
      update.action === 'keep'
        ? 'none'
        : update.action === 'remove'
          ? hadReceipt
            ? 'removed'
            : 'none'
          : hadReceipt
            ? 'replaced'
            : 'added',
  })
  return { ok: true }
}

export async function deleteTransaction(
  deps: TransactionDeps,
  propertyId: string,
  transactionId: string,
): Promise<{ ok: true } | Failure> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const result = await deps.transactions.delete(
    deps.userId,
    propertyId,
    transactionId,
  )
  if (!result.applied) {
    return entryNotFound
  }
  await deleteFiles(deps, result.removedKeys)
  deps.log.info('transaction.deleted', { propertyId, transactionId })
  return { ok: true }
}
