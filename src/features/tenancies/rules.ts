// Date rules for adding and correcting a tenancy (openspec: tenancies,
// "Tenancy dates and details"), checked on the server against today in
// Finland, the flat's first ownership start and its other tenancies. The
// write checks the overlap again. Pure.
import type { IsoDate } from '#/lib/dates'
import type { FieldReason } from '#/lib/reasons'
import type { ContractType } from '#/server/db/schema'

export type TenancyDateProblem = Extract<
  FieldReason,
  | 'tenancy_contract_made_in_future'
  | 'tenancy_end_before_start'
  | 'tenancy_start_before_ownership'
  | 'tenancy_overlaps'
>

/** A period; `to` null runs indefinitely. */
interface Span {
  from: IsoDate
  to: IsoDate | null
}

/** Whether two periods share a day. */
export function overlaps(a: Span, b: Span): boolean {
  return (a.to === null || b.from <= a.to) && (b.to === null || b.to >= a.from)
}

export function validateTenancyDates(
  tenancy: {
    contractType: ContractType
    contractMade: IsoDate
    validFrom: IsoDate
    termEnd: IsoDate | null
    /** The last day after this save: the term's end, or a recorded ending. */
    validTo: IsoDate | null
  },
  limits: {
    today: IsoDate
    ownershipStart: IsoDate
    /** The flat's other tenancies. */
    others: readonly { validFrom: IsoDate; validTo: IsoDate | null }[]
  },
): TenancyDateProblem | undefined {
  if (tenancy.contractMade > limits.today) {
    return 'tenancy_contract_made_in_future'
  }
  if (
    tenancy.contractType === 'fixed_term' &&
    (tenancy.termEnd === null || tenancy.termEnd <= tenancy.validFrom)
  ) {
    return 'tenancy_end_before_start'
  }
  if (tenancy.validTo !== null && tenancy.validTo < tenancy.validFrom) {
    return 'tenancy_end_before_start'
  }
  if (tenancy.validFrom < limits.ownershipStart) {
    return 'tenancy_start_before_ownership'
  }
  const span = { from: tenancy.validFrom, to: tenancy.validTo }
  if (
    limits.others.some((other) =>
      overlaps(span, { from: other.validFrom, to: other.validTo }),
    )
  ) {
    return 'tenancy_overlaps'
  }
  return undefined
}

/**
 * Whether any of these payment months (`YYYY-MM`) falls outside the months
 * of a tenancy running `from`–`to` (none: indefinitely); payments stay
 * inside their tenancy (openspec: rent-payments).
 */
export function paymentsOutside(
  months: readonly string[],
  from: IsoDate,
  to: IsoDate | null,
): boolean {
  const first = from.slice(0, 7)
  const last = to?.slice(0, 7)
  return months.some(
    (month) => month < first || (last !== undefined && month > last),
  )
}
