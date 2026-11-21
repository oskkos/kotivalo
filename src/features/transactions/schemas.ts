// Input for entries, shared by the form and the server functions. The
// receipt file travels next to these fields in the same FormData and is
// checked by checkUpload() on the server. Errors are reason codes
// (src/lib/reasons.ts), never text.
import { z } from 'zod'
import { typedDate } from '#/features/ownership/schemas'
import { parseDecimal } from '#/lib/decimal'
import type { FieldReason } from '#/lib/reasons'
import { TRANSACTION_CATEGORIES, TRANSACTION_TYPES } from '#/server/db/schema'
import { categoryFits } from './categories'

const id = z.string().min(1).max(64)

/** The largest amount: 99 999,99 €. */
export const MAX_TRANSACTION_AMOUNT = 9_999_999

/** The longest note, in characters. */
export const MAX_NOTE_LENGTH = 200

/** An amount as typed in euros, from 0,01: in cents. */
export const typedTransactionAmount = z
  .string({ error: 'transaction_amount_invalid' satisfies FieldReason })
  .transform((text, context) => {
    const cents = parseDecimal(text, 2)
    if (cents === undefined || cents < 1 || cents > MAX_TRANSACTION_AMOUNT) {
      context.addIssue({
        code: 'custom',
        message: 'transaction_amount_invalid' satisfies FieldReason,
      })
      return z.NEVER
    }
    return cents
  })

/** An optional note: trimmed, empty becomes null. */
export const typedNote = z
  .string()
  .trim()
  .max(MAX_NOTE_LENGTH, {
    error: 'transaction_note_too_long' satisfies FieldReason,
  })
  .transform((note) => (note === '' ? null : note))

/** The fields of an entry, as typed. */
export const transactionFields = z
  .object({
    type: z.enum(TRANSACTION_TYPES, {
      error: 'transaction_category_invalid' satisfies FieldReason,
    }),
    category: z.enum(TRANSACTION_CATEGORIES, {
      error: 'transaction_category_invalid' satisfies FieldReason,
    }),
    amount: typedTransactionAmount,
    date: typedDate,
    note: typedNote,
  })
  .refine((fields) => categoryFits(fields.type, fields.category), {
    path: ['category'],
    error: 'transaction_category_invalid' satisfies FieldReason,
  })

export const createTransactionInput = transactionFields.and(
  z.object({ propertyId: id }),
)

/** What to do with the receipt when an entry is saved again. */
export const RECEIPT_ACTIONS = ['keep', 'remove', 'replace'] as const

export const updateTransactionInput = transactionFields.and(
  z.object({
    propertyId: id,
    transactionId: id,
    receiptAction: z.enum(RECEIPT_ACTIONS),
  }),
)

export const transactionRefInput = z.object({
  propertyId: id,
  transactionId: id,
})

export type TransactionFieldsInput = z.input<typeof transactionFields>
