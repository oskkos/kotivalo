// Input for ownership changes, shared by the forms and the server functions.
// Errors are reason codes (src/lib/reasons.ts), never text.
import { z } from 'zod'
import { parseFiDate } from '#/lib/dates'
import type { FieldReason } from '#/lib/reasons'
import { OWNERSHIP_REASONS } from '#/server/db/schema'
import { parsePercent } from './periods'

const id = z.string().min(1).max(64)

/** A date as typed: "12.6.2022" or "2022-06-12". */
export const typedDate = z
  .string({ error: 'date_invalid' satisfies FieldReason })
  .transform((text, context) => {
    const date = parseFiDate(text)
    if (date === undefined) {
      context.addIssue({ code: 'custom', message: 'date_invalid' })
      return z.NEVER
    }
    return date
  })

/** A share as typed in percent: "50", "33,33". */
export const typedPercent = z
  .string({ error: 'ownership_share_invalid' satisfies FieldReason })
  .transform((text, context) => {
    const share = parsePercent(text)
    if (share === undefined) {
      context.addIssue({ code: 'custom', message: 'ownership_share_invalid' })
      return z.NEVER
    }
    return share
  })

export const propertyRefInput = z.object({ propertyId: id })

export const changeOwnershipInput = z.object({
  propertyId: id,
  from: typedDate,
  reason: z.enum(OWNERSHIP_REASONS),
  shares: z.array(z.object({ userId: id, percent: typedPercent })).max(100),
  /** People going to 0 % whose access goes too. */
  removeAccess: z.array(id).max(100),
})

export type ChangeOwnershipInput = z.input<typeof changeOwnershipInput>

export const correctFirstDateInput = z.object({
  propertyId: id,
  date: typedDate,
})
