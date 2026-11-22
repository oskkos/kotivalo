// Input for rent payments, shared by the record dialog and the server
// functions (openspec: rent-payments). Errors are reason codes
// (src/lib/reasons.ts), never text.
import { z } from 'zod'
import { typedDate } from '#/features/ownership/schemas'
import { parseDecimal } from '#/lib/decimal'
import type { FieldReason } from '#/lib/reasons'

const id = z.string().min(1).max(64)

/** The largest payment: 100 000,00 €. */
export const MAX_RENT_PAYMENT = 10_000_000

/** A rent's month as `YYYY-MM`. */
export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

export const typedMonth = z.string().regex(MONTH)

/** An amount as typed in euros, from 0,01 to 100 000: in cents. */
export const typedRentPayment = z
  .string({ error: 'rent_payment_amount_invalid' satisfies FieldReason })
  .transform((text, context) => {
    const cents = parseDecimal(text, 2)
    if (cents === undefined || cents < 1 || cents > MAX_RENT_PAYMENT) {
      context.addIssue({
        code: 'custom',
        message: 'rent_payment_amount_invalid' satisfies FieldReason,
      })
      return z.NEVER
    }
    return cents
  })

/** What the dialog sends: the payment as typed. */
export const recordRentPaymentInput = z.object({
  propertyId: id,
  tenancyId: id,
  month: typedMonth,
  amount: typedRentPayment,
  paidOn: typedDate,
})

export type RecordRentPaymentInput = z.input<typeof recordRentPaymentInput>

export const deleteRentPaymentInput = z.object({
  propertyId: id,
  paymentId: id,
})

export const rentPaymentsInput = z.object({ propertyId: id })

export const rentMonthInput = z.object({
  propertyId: id,
  tenancyId: id,
  month: typedMonth,
})
