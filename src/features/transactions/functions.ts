// Server functions for entries and receipts, called by the Entries page, the
// details page and the entry form. The logic is in transactions.server.ts;
// these check the session, wire in the request context and read the form
// data. Saving takes FormData, so the receipt file travels with the entry.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { isReason, type Reason } from '#/lib/reasons'
import { MAX_UPLOAD_BYTES } from '#/server/files/upload'
import { getRequestContext } from '#/server/platform/context.server'
import {
  createTransactionInput,
  transactionRefInput,
  updateTransactionInput,
} from './schemas'
import { transactionRepository } from './transaction.repository.server'
import {
  createTransaction as create,
  deleteTransaction as remove,
  getNewTransactionOptions as newOptions,
  getEntriesSince as entriesSinceOf,
  getTransaction as getOne,
  WATER_CATEGORIES,
  getTransactions as getList,
  updateTransaction as update,
  type TransactionDeps,
  type Upload,
} from './transactions.server'

/**
 * The signed-in user's dependencies. Pages are protected by the signed-in
 * layout, endpoints are not: without a session this throws.
 */
async function transactionDeps(): Promise<TransactionDeps> {
  const context = getRequestContext()
  const session = await context.auth.getSession()
  if (!session) {
    throw new Error('Not signed in')
  }
  return {
    userId: session.user.id,
    transactions: transactionRepository(context.db),
    properties: propertyRepository(context.db),
    ownership: ownershipRepository(context.db),
    sharing: sharingRepository(context.db),
    storage: context.storage,
    log: context.log,
    now: () => new Date(),
  }
}

/** The form's text fields and its receipt file, if one was attached. */
interface FormInput {
  fields: Record<string, string>
  receipt: File | null
}

/** Reads the entry form's FormData; anything else is a bug. */
function readForm(data: unknown): FormInput {
  if (!(data instanceof FormData)) {
    throw new Error('Expected form data')
  }
  const fields: Record<string, string> = {}
  let receipt: File | null = null
  for (const [name, value] of data.entries()) {
    if (name === 'receipt') {
      if (typeof value !== 'string' && value.size > 0) {
        receipt = value
      }
    } else if (typeof value === 'string') {
      fields[name] = value
    }
  }
  return { fields, receipt }
}

/** The first issue's reason code; an issue without one is a bug. */
function firstReason(error: z.ZodError): { ok: false; reason: Reason } {
  const reason = error.issues[0]?.message
  if (!isReason(reason)) {
    throw new Error('Invalid entry input')
  }
  return { ok: false, reason }
}

/** The file's bytes, or the reason it is refused before reading it all. */
async function readUpload(
  file: File,
): Promise<Upload | { ok: false; reason: 'receipt_too_large' }> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: 'receipt_too_large' }
  }
  return {
    bytes: new Uint8Array(await file.arrayBuffer()),
    filename: file.name,
  }
}

export const getTransactions = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      propertyId: z.string().min(1).max(64),
      year: z.number().int().min(2000).max(2100).optional(),
    }),
  )
  .handler(async ({ data }) =>
    getList(await transactionDeps(), data.propertyId, data.year),
  )

export const getTransaction = createServerFn({ method: 'GET' })
  .validator(transactionRefInput)
  .handler(async ({ data }) =>
    getOne(await transactionDeps(), data.propertyId, data.transactionId),
  )

export const getNewTransactionOptions = createServerFn({
  method: 'GET',
}).handler(async () => newOptions(await transactionDeps()))

export const createTransaction = createServerFn({ method: 'POST' })
  .validator(readForm)
  .handler(async ({ data }) => {
    const parsed = createTransactionInput.safeParse(data.fields)
    if (!parsed.success) {
      return firstReason(parsed.error)
    }
    const { propertyId, ...fields } = parsed.data
    let upload: Upload | null = null
    if (data.receipt) {
      const read = await readUpload(data.receipt)
      if ('ok' in read) {
        return read
      }
      upload = read
    }
    return create(await transactionDeps(), propertyId, fields, upload)
  })

export const updateTransaction = createServerFn({ method: 'POST' })
  .validator(readForm)
  .handler(async ({ data }) => {
    const parsed = updateTransactionInput.safeParse(data.fields)
    if (!parsed.success) {
      return firstReason(parsed.error)
    }
    const { propertyId, transactionId, receiptAction, ...fields } = parsed.data
    if (receiptAction !== 'replace') {
      return update(
        await transactionDeps(),
        propertyId,
        transactionId,
        fields,
        {
          action: receiptAction,
        },
      )
    }
    if (!data.receipt) {
      throw new Error('Replacing a receipt needs a file')
    }
    const read = await readUpload(data.receipt)
    if ('ok' in read) {
      return read
    }
    return update(await transactionDeps(), propertyId, transactionId, fields, {
      action: 'replace',
      upload: read,
    })
  })

export const deleteTransaction = createServerFn({ method: 'POST' })
  .validator(transactionRefInput)
  .handler(async ({ data }) =>
    remove(await transactionDeps(), data.propertyId, data.transactionId),
  )

/** The flat's water entries from a date on, for the charge and fee forms. */
export const entriesSince = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      propertyId: z.string().min(1).max(64),
      category: z.enum(WATER_CATEGORIES),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data }) =>
    entriesSinceOf(
      await transactionDeps(),
      data.propertyId,
      data.category,
      data.from,
    ),
  )
