// Input for the year summary's server functions and routes (openspec:
// year-summary). The year is optional: without it the summary opens on the
// opening year.
import { z } from 'zod'

/** A year the summary may be asked for; the range is clamped later. */
export const summaryYear = z.number().int().min(2000).max(2100)

/**
 * A year as the pages' URL gives it: one outside 2000–2100 is moved to the
 * nearest end, and one that isn't a whole number is left out, so the server
 * opens the nearest year it has (openspec: year-summary, "The year the
 * summary opens on").
 */
export const urlYear = z
  .number()
  .int()
  .transform((year) => Math.min(Math.max(year, 2000), 2100))
  .optional()
  .catch(undefined)

export const yearSummaryInput = z.object({ year: summaryYear.optional() })

export const flatYearInput = z.object({
  propertyId: z.string().min(1).max(64),
  year: summaryYear.optional(),
})
