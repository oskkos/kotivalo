// Input for sharing a flat, shared by the forms and the server functions.
// Errors are reason codes (src/lib/reasons.ts), never text.
import { z } from 'zod'
import { emailSchema } from '#/features/authentication/schemas'

const id = z.string().min(1).max(64)

export const propertyRefInput = z.object({ propertyId: id })

export const inviteInput = z.object({ propertyId: id, email: emailSchema })

export const invitationIdInput = z.object({ invitationId: id })

export const removeAccessInput = z.object({ propertyId: id, userId: id })
