// Tenancy and flat statuses on a given day, and due dates (openspec:
// tenancies, "Tenancy statuses", "Tenancy dates and details"). Pure.
import { lastDayOfMonth, type IsoDate } from '#/lib/dates'
import type { ContractType, NoticeGiver } from '#/server/db/schema'

export interface StatusTenancy {
  contractType: ContractType
  validFrom: IsoDate
  validTo: IsoDate | null
  termEnd: IsoDate | null
  noticeGivenBy: NoticeGiver | null
  noticeDate: IsoDate | null
}

export type TenancyStatus =
  | { kind: 'starts'; on: IsoDate }
  | { kind: 'active' }
  | { kind: 'ends'; on: IsoDate }
  | { kind: 'notice_given'; on: IsoDate }
  | { kind: 'ended'; on: IsoDate }

/** A tenancy's status on `today`. */
export function tenancyStatus(
  tenancy: StatusTenancy,
  today: IsoDate,
): TenancyStatus {
  const { validFrom, validTo, noticeDate } = tenancy
  if (today < validFrom) {
    return { kind: 'starts', on: validFrom }
  }
  if (validTo !== null && today > validTo) {
    return { kind: 'ended', on: validTo }
  }
  if (
    validTo !== null &&
    tenancy.noticeGivenBy !== null &&
    noticeDate !== null &&
    today >= noticeDate
  ) {
    return { kind: 'notice_given', on: validTo }
  }
  const termEnd = tenancy.termEnd ?? validTo
  if (tenancy.contractType === 'fixed_term' && termEnd !== null) {
    return { kind: 'ends', on: termEnd }
  }
  return { kind: 'active' }
}

/** Whether the tenancy runs on `day`. */
export function runsOn(
  tenancy: Pick<StatusTenancy, 'validFrom' | 'validTo'>,
  day: IsoDate,
): boolean {
  return (
    tenancy.validFrom <= day &&
    (tenancy.validTo === null || tenancy.validTo >= day)
  )
}

export type FlatStatus<T> =
  | { kind: 'let'; tenancy: T }
  | { kind: 'notice_given'; tenancy: T; on: IsoDate }
  | { kind: 'vacant'; next: T | null; since: IsoDate | null }

/**
 * A flat's status on `today` from its tenancies: let or notice given while
 * one runs, otherwise vacant, with the next tenancy to start and the day
 * the last one ended.
 */
export function flatStatus<T extends StatusTenancy>(
  tenancies: readonly T[],
  today: IsoDate,
): FlatStatus<T> {
  const running = tenancies.find((tenancy) => runsOn(tenancy, today))
  if (running) {
    const status = tenancyStatus(running, today)
    return status.kind === 'notice_given'
      ? { kind: 'notice_given', tenancy: running, on: status.on }
      : { kind: 'let', tenancy: running }
  }
  const upcoming = tenancies
    .filter((tenancy) => tenancy.validFrom > today)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
  const ended = tenancies
    .map((tenancy) => tenancy.validTo)
    .filter((day): day is IsoDate => day !== null && day < today)
    .sort()
  return {
    kind: 'vacant',
    next: upcoming[0] ?? null,
    since: ended.at(-1) ?? null,
  }
}

/** The due date in a month `YYYY-MM`, capped at the month's last day. */
export function dueDate(dueDay: number, month: string): IsoDate {
  const last = lastDayOfMonth(month)
  const day = Math.min(dueDay, Number(last.slice(8)))
  return `${month}-${String(day).padStart(2, '0')}`
}

/**
 * The tenancy a flat's page shows: the one running on `today`, or else the
 * next one to start; null when there is neither.
 */
export function currentTenancy<T extends StatusTenancy>(
  tenancies: readonly T[],
  today: IsoDate,
): T | null {
  const status = flatStatus(tenancies, today)
  return status.kind === 'vacant' ? status.next : status.tenancy
}
