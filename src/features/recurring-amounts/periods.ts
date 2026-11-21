// Rent, charges and the financing charge treatment as monthly periods
// (openspec: recurring-amounts). Pure functions: no database access.
import type { IsoDate } from '#/lib/dates'

/** One period of a value: an amount in cents, or a treatment. */
export interface Period<T> {
  validFrom: IsoDate
  /** Null for the current, open-ended period. */
  validTo: IsoDate | null
  value: T
}
