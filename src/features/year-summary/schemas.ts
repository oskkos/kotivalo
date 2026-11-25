// Input for the year summary's server functions and routes (openspec:
// year-summary). The year is optional: without it the summary opens on the
// opening year.
import { z } from 'zod'

/** A year the summary may be asked for; the range is clamped later. */
export const summaryYear = z.number().int().min(2000).max(2100)

export const yearSummaryInput = z.object({ year: summaryYear.optional() })

export const flatYearInput = z.object({
  propertyId: z.string().min(1).max(64),
  year: summaryYear.optional(),
})
