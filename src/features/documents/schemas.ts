// Input for documents, shared by the form and the server functions. The file
// travels next to these fields in the same FormData and is checked by
// checkUpload() on the server. Errors are reason codes, never text.
import { z } from 'zod'
import { typedDate } from '#/features/ownership/schemas'
import type { FieldReason } from '#/lib/reasons'
import { DOCUMENT_KINDS } from '#/server/db/schema'

const id = z.string().min(1).max(64)

/** The longest name, in characters. */
export const MAX_DOCUMENT_NAME_LENGTH = 100

/** The fields of a document, as typed. The tenancy counts for a lease only. */
export const documentFields = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  name: z
    .string()
    .trim()
    .min(1, { error: 'document_name_required' satisfies FieldReason })
    .max(MAX_DOCUMENT_NAME_LENGTH, {
      error: 'document_name_too_long' satisfies FieldReason,
    }),
  date: typedDate,
  tenancyId: z
    .string()
    .max(64)
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
})

export const addDocumentInput = documentFields.and(z.object({ propertyId: id }))

export const updateDocumentInput = documentFields.and(
  z.object({ propertyId: id, documentId: id }),
)

export const documentRefInput = z.object({ propertyId: id, documentId: id })
