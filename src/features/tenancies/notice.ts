// Notice periods and the rules for ending a tenancy (openspec: tenancies,
// "Notice periods", "Ending a tenancy", "Ending a fixed-term tenancy early";
// CONCEPT.md §4.2, Act on Residential Leases 481/1995 §52 as amended by
// 531/2026). Pure.
import { addMonths, addYears, lastDayOfMonth, type IsoDate } from '#/lib/dates'
import type { FieldReason } from '#/lib/reasons'
import type { ContractType, NoticeGiver } from '#/server/db/schema'

/**
 * Contracts made from this day get the new landlord's notice periods; older
 * ones keep the old rule (531/2026, transitional provision).
 */
export const LANDLORD_RULE_CHANGE: IsoDate = '2026-10-01'

/** What the notice period depends on. */
export interface NoticeTenancy {
  contractType: ContractType
  contractMade: IsoDate
  validFrom: IsoDate
  termEnd: IsoDate | null
}

/**
 * The notice period in months: 1 for the tenant; for the landlord 6 (older
 * contracts, after a year) or 4 (newer, after two years), otherwise 3; none
 * for an agreed ending, a court's permission or another legal ground.
 */
export function noticePeriodMonths(
  by: NoticeGiver,
  tenancy: NoticeTenancy,
  noticeDate: IsoDate,
): number {
  if (by === 'tenant') {
    return 1
  }
  if (by !== 'landlord') {
    return 0
  }
  const older = tenancy.contractMade < LANDLORD_RULE_CHANGE
  const years = older ? 1 : 2
  const lasted = addYears(tenancy.validFrom, years) <= noticeDate
  if (!lasted) {
    return 3
  }
  return older ? 6 : 4
}

/**
 * The earliest last rent day: the period runs from the last day of the
 * month in which notice was given. With no period, the notice date itself.
 */
export function earliestLastDay(
  by: NoticeGiver,
  tenancy: NoticeTenancy,
  noticeDate: IsoDate,
): IsoDate {
  const months = noticePeriodMonths(by, tenancy, noticeDate)
  if (months === 0) {
    return noticeDate
  }
  return lastDayOfMonth(addMonths(noticeDate.slice(0, 7), months))
}

export type EndingProblem = Extract<
  FieldReason,
  | 'tenancy_fixed_term_notice'
  | 'tenancy_notice_in_future'
  | 'tenancy_notice_before_start'
  | 'tenancy_end_before_notice'
  | 'tenancy_end_after_term'
  | 'tenancy_end_before_notice_period'
>

/**
 * Why an ending can't be recorded, or nothing. Only the landlord's notice
 * has a lower limit: a term shortening it is void, while the contract may
 * shorten the tenant's period or count it from mid-month (§52).
 */
export function validateEnding(
  tenancy: NoticeTenancy,
  ending: { noticeGivenBy: NoticeGiver; noticeDate: IsoDate; lastDay: IsoDate },
  today: IsoDate,
): EndingProblem | undefined {
  const { noticeGivenBy: by, noticeDate, lastDay } = ending
  const fixed = tenancy.contractType === 'fixed_term'
  if (fixed && (by === 'tenant' || by === 'landlord')) {
    return 'tenancy_fixed_term_notice'
  }
  if (noticeDate > today) {
    return 'tenancy_notice_in_future'
  }
  if (noticeDate < tenancy.validFrom) {
    return 'tenancy_notice_before_start'
  }
  if (lastDay < noticeDate) {
    return 'tenancy_end_before_notice'
  }
  if (fixed && tenancy.termEnd !== null && lastDay >= tenancy.termEnd) {
    return 'tenancy_end_after_term'
  }
  if (by === 'landlord' && lastDay < earliestLastDay(by, tenancy, noticeDate)) {
    return 'tenancy_end_before_notice_period'
  }
  return undefined
}
