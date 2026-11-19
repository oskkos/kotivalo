// Flat details, shared by the form and the server functions. Errors are
// reason codes (src/lib/reasons.ts), never text.
import { z } from 'zod'
import { parseDecimal } from '#/lib/decimal'
import type { FieldReason } from '#/lib/reasons'
import type { RoomCount } from './property'

const reason = (code: FieldReason) => ({ error: code })

const MAX_TEXT = 100
/** Floor area limits in tenths of m²: 1–10 000 m². */
const MIN_AREA = 10
const MAX_AREA = 100_000

const requiredText = (code: FieldReason) =>
  z
    .string(reason(code))
    .trim()
    .min(1, reason(code))
    .max(MAX_TEXT, reason('text_too_long'))

/**
 * The details as the form holds them: the floor area as typed ("48,5"), the
 * room count 0 until one is chosen. Parsed into PropertyDetails.
 */
export const propertyDetailsInput = z.object({
  streetAddress: requiredText('street_address_required'),
  postcode: z
    .string(reason('postcode_invalid'))
    .trim()
    .regex(/^\d{5}$/, reason('postcode_invalid')),
  city: requiredText('city_required'),
  roomCount: z
    .number(reason('room_count_required'))
    .int(reason('room_count_required'))
    .min(1, reason('room_count_required'))
    .max(4, reason('room_count_required'))
    .transform((count) => count as RoomCount),
  floorArea: z
    .string(reason('floor_area_invalid'))
    .transform((text, context) => {
      const tenths = parseDecimal(text, 1)
      if (tenths === undefined || tenths < MIN_AREA || tenths > MAX_AREA) {
        context.addIssue({ code: 'custom', message: 'floor_area_invalid' })
        return z.NEVER
      }
      return tenths
    }),
})

export type PropertyDetailsInput = z.input<typeof propertyDetailsInput>

export const propertyIdInput = z.object({ id: z.string().min(1).max(64) })

export const updatePropertyInput = propertyDetailsInput.extend(
  propertyIdInput.shape,
)
