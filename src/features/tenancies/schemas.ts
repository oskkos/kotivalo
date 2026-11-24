// Input for tenancies, shared by the forms and the server functions. Date
// rules that need the flat's other tenancies or today are in rules.ts and
// notice.ts. Errors are reason codes (src/lib/reasons.ts), never text.
import { z } from 'zod'
import { typedDate } from '#/features/ownership/schemas'
import { typedAmount } from '#/features/recurring-amounts/schemas'
import type { FieldReason } from '#/lib/reasons'
import { CONTRACT_TYPES, NOTICE_GIVERS } from '#/server/db/schema'

const id = z.string().min(1).max(64)
const reason = (code: FieldReason) => ({ error: code })

/** The longest tenant name and phone number, in characters. */
export const MAX_TENANT_NAME = 100
export const MAX_TENANT_PHONE = 30

/** Trimmed text; empty becomes null. */
const optional = (max: number, code: FieldReason) =>
  z
    .string(reason(code))
    .trim()
    .max(max, reason(code))
    .transform((text) => (text === '' ? null : text))

export const typedTenantName = z
  .string(reason('tenant_name_required'))
  .trim()
  .min(1, reason('tenant_name_required'))
  .max(MAX_TENANT_NAME, reason('tenant_name_too_long'))

export const typedTenantPhone = optional(
  MAX_TENANT_PHONE,
  'tenant_phone_too_long',
)

/** An optional email address: trimmed, empty becomes null. */
export const typedTenantEmail = z
  .string(reason('email_invalid'))
  .trim()
  .max(254, reason('email_invalid'))
  .transform((text, context) => {
    if (text === '') {
      return null
    }
    if (!z.email().safeParse(text).success) {
      context.addIssue({ code: 'custom', message: 'email_invalid' })
      return z.NEVER
    }
    return text
  })

/** A due day as typed: a whole number from 1 to 31. */
export const typedDueDay = z
  .string(reason('tenancy_due_day_invalid'))
  .trim()
  .transform((text, context) => {
    const day = /^\d{1,2}$/.test(text) ? Number(text) : Number.NaN
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      context.addIssue({ code: 'custom', message: 'tenancy_due_day_invalid' })
      return z.NEVER
    }
    return day
  })

/** A tenancy's details as typed; the term's end only for a fixed term. */
export const tenancyFields = z
  .object({
    tenantName: typedTenantName,
    tenantPhone: typedTenantPhone,
    tenantEmail: typedTenantEmail,
    contractType: z.enum(CONTRACT_TYPES),
    contractMade: typedDate,
    validFrom: typedDate,
    termEnd: z.string().trim(),
    dueDay: typedDueDay,
  })
  .transform((fields, context) => {
    if (fields.contractType === 'open_ended') {
      return { ...fields, termEnd: null }
    }
    const termEnd = typedDate.safeParse(fields.termEnd)
    if (!termEnd.success) {
      context.addIssue({
        code: 'custom',
        path: ['termEnd'],
        message: 'tenancy_end_before_start' satisfies FieldReason,
      })
      return z.NEVER
    }
    return { ...fields, termEnd: termEnd.data }
  })

/** How a tenancy ended, or how notice was given: the end form's fields. */
const endingFields = z.object({
  noticeGivenBy: z.enum(NOTICE_GIVERS),
  noticeDate: typedDate,
  lastDay: typedDate,
})

export const createTenancyInput = tenancyFields.and(
  z.object({
    propertyId: id,
    /** The tenancy's first rent, from its start. */
    rent: typedAmount,
    /** An earlier tenancy's ending, recorded with it. */
    ending: endingFields.optional(),
  }),
)

export const updateTenancyInput = tenancyFields.and(
  z.object({ propertyId: id, tenancyId: id }),
)

export const endTenancyInput = endingFields.extend({
  propertyId: id,
  tenancyId: id,
})

export const tenancyRefInput = z.object({ propertyId: id, tenancyId: id })

export const propertyRefInput = z.object({ propertyId: id })

export type TenancyFieldsInput = z.input<typeof tenancyFields>
