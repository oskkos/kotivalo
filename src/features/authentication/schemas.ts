// Input for signing in, shared by the forms and the server functions. Errors
// are reason codes (src/lib/reasons.ts), never text.
import { z } from 'zod'
import type { FieldReason } from '#/lib/reasons'
import { locales } from '#/paraglide/runtime.js'

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

/** One of the app's languages: `fi`, `sv` or `en`. */
export const localeSchema = z.enum(locales)

export const localeInput = z.object({ locale: localeSchema })

/**
 * `locale` is sent only when the user chose a language on the sign-in page
 * in this tab (spec: "Choosing the language before sign-in").
 */
export const requestCodeInput = z.object({
  email: emailSchema,
  locale: localeSchema.optional(),
})

export const verifyCodeInput = z.object({
  email: emailSchema,
  code: codeSchema,
  locale: localeSchema.optional(),
})

/**
 * The name shown to the people a user shares flats with, also in invitation
 * emails. No characters of addresses and links, so a name can't pose as an
 * address or carry a link into an email that Kotivalo sends: no `@ / : < >`,
 * no domain such as `www.evil.example` (a dot right before a letter or digit,
 * which email clients turn into a link; `A. Virtanen` is fine) and no line
 * breaks or other control characters.
 */
export const displayNameSchema = z
  .string(reason('name_required'))
  .trim()
  .min(1, reason('name_required'))
  .max(50, reason('name_too_long'))
  .regex(/^[^@/:<>\p{Cc}]*$/u, reason('name_invalid'))
  .refine((name) => !/\.[\p{L}\p{N}]/u.test(name), reason('name_invalid'))

export const displayNameInput = z.object({ name: displayNameSchema })
