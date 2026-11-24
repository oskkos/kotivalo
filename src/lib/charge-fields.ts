// What a usage charge or a tenant fee is: its kind, basis and description
// (openspec: usage-charges, tenancies "Tenant fees are recorded as periods").
// Shared by both, because their fields and rules are the same. Errors are
// reason codes (src/lib/reasons.ts), never text.
import { z } from 'zod'
import type { FieldReason } from '#/lib/reasons'
import { CHARGE_BASES, CHARGE_KINDS } from '#/server/db/schema'

/** The longest description of an `other` charge, in characters. */
export const MAX_CHARGE_DESCRIPTION = 60

/** A fee or charge as typed: the description only for the kind `other`. */
export const chargeFields = z
  .object({
    kind: z.enum(CHARGE_KINDS),
    basis: z.enum(CHARGE_BASES),
    description: z.string().trim(),
  })
  .transform((fields, context) => {
    if (fields.kind !== 'other') {
      return { ...fields, description: null }
    }
    if (
      fields.description.length === 0 ||
      fields.description.length > MAX_CHARGE_DESCRIPTION
    ) {
      context.addIssue({
        code: 'custom',
        path: ['description'],
        message: 'description_required' satisfies FieldReason,
      })
      return z.NEVER
    }
    return fields
  })

/** The basis a kind is added with: water per occupant, the rest fixed. */
export const defaultBasis = (
  kind: (typeof CHARGE_KINDS)[number],
): (typeof CHARGE_BASES)[number] =>
  kind === 'water' ? 'per_occupant' : 'fixed'
