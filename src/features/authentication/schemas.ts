// Input for signing in, shared by the forms and the server functions. Errors
// are reason codes (src/lib/reasons.ts), never text.
import { z } from 'zod'
import type { FieldReason } from '#/lib/reasons'

const reason = (code: FieldReason) => ({ error: code })

/** Trimmed and lowercased, so addresses compare without regard to case. */
export const emailSchema = z
  .string(reason('email_invalid'))
  .trim()
  .toLowerCase()
  .max(254, reason('email_invalid'))
  .pipe(z.email(reason('email_invalid')))

export const codeSchema = z
  .string(reason('code_invalid'))
  .trim()
  .regex(/^\d{6}$/, reason('code_invalid'))

export const requestCodeInput = z.object({ email: emailSchema })

export const verifyCodeInput = z.object({
  email: emailSchema,
  code: codeSchema,
})
