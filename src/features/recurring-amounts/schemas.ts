// Input for rent, charges and the financing charge treatment, shared by the
// forms and the server functions. Errors are reason codes
// (src/lib/reasons.ts), never text.
import { z } from 'zod'
import { typedDate } from '#/features/ownership/schemas'
import { parseDecimal } from '#/lib/decimal'
import type { FieldReason } from '#/lib/reasons'
import {
  FINANCING_TREATMENTS,
  RECURRING_AMOUNT_KINDS,
} from '#/server/db/schema'

const id = z.string().min(1).max(64)

/** The largest monthly amount: 99 999,99 €. */
export const MAX_AMOUNT = 9_999_999

/** A monthly amount as typed in euros: "214", "214,50", in cents. */
export const typedAmount = z
  .string({ error: 'amount_invalid' satisfies FieldReason })
  .transform((text, context) => {
    const cents = parseDecimal(text, 2)
    if (cents === undefined || cents > MAX_AMOUNT) {
      context.addIssue({ code: 'custom', message: 'amount_invalid' })
      return z.NEVER
    }
    return cents
  })

/** A start date as typed; amounts and treatments change on the 1st. */
export const monthStartDate = typedDate.refine((date) => date.endsWith('-01'), {
  error: 'amount_date_not_month_start' satisfies FieldReason,
})

export const recurringAmountKind = z.enum(RECURRING_AMOUNT_KINDS)

export const propertyRefInput = z.object({ propertyId: id })

export const setAmountInput = z.object({
  propertyId: id,
  kind: recurringAmountKind,
  amount: typedAmount,
  from: monthStartDate,
})

export const undoAmountInput = z.object({
  propertyId: id,
  kind: recurringAmountKind,
})

export const setTreatmentInput = z.object({
  propertyId: id,
  treatment: z.enum(FINANCING_TREATMENTS),
  from: monthStartDate,
})

export type SetAmountInput = z.input<typeof setAmountInput>
export type SetTreatmentInput = z.input<typeof setTreatmentInput>
