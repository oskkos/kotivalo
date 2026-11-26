// Input for deposit returns, shared by the return form and the server
// functions (openspec: deposits). Errors are reason codes
// (src/lib/reasons.ts), never text. The rules that need the tenancy, its
// deposit or today are in deposit.ts.
import { z } from 'zod'
import { typedDate } from '#/features/ownership/schemas'
import { parseDecimal } from '#/lib/decimal'
import type { FieldReason } from '#/lib/reasons'
import { MAX_DEPOSIT } from '#/features/tenancies/schemas'

const id = z.string().min(1).max(64)

/** An amount kept, in euros as typed: empty is 0, else 0 to 100 000, in cents. */
export const typedKept = z
  .string({ error: 'deposit_amount_invalid' satisfies FieldReason })
  .trim()
  .transform((text, context) => {
    if (text === '') {
      return 0
    }
    const cents = parseDecimal(text, 2)
    if (cents === undefined || cents < 0 || cents > MAX_DEPOSIT) {
      context.addIssue({ code: 'custom', message: 'deposit_amount_invalid' })
      return z.NEVER
    }
    return cents
  })

/** The return as typed. In full keeps nothing, whatever the amounts say. */
export const depositReturnFields = z
  .object({
    returnedOn: typedDate,
    deductions: z.boolean(),
    rentKept: typedKept.prefault(''),
    damageKept: typedKept.prefault(''),
    note: z
      .string()
      .trim()
      .transform((text) => (text === '' ? null : text))
      .prefault(''),
  })
  .transform((fields) =>
    fields.deductions
      ? fields
      : { ...fields, rentKept: 0, damageKept: 0, note: null },
  )

export const depositReturnRefInput = z.object({
  propertyId: id,
  tenancyId: id,
})

export const depositReturnInput = depositReturnRefInput.and(depositReturnFields)

export type DepositReturnInput = z.input<typeof depositReturnInput>
