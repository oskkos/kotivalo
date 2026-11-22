// Whether the new tenant form asks for the rent (openspec: tenancies, "The
// rent of a new tenancy"). A changed rent is saved from the start month, and
// rent periods change only at the end, so a tenancy starting before the
// latest rent period leaves the rent to the Rent and charges page. Pure.
import { monthOf, type Period } from '#/features/recurring-amounts/periods'
import type { IsoDate } from '#/lib/dates'

/** True with no rent period, or a start month on or after the latest one. */
export function rentAsked(
  rents: readonly Period<number>[],
  start: IsoDate,
): boolean {
  const latest = rents.at(-1)
  return latest === undefined || monthOf(start) >= monthOf(latest.validFrom)
}
