// Ownership periods as pure rules (openspec: ownership): grouping stored
// rows into periods, the split on a date, and the checks on a new split and
// its date. No database access, so the year summary can reuse them.
import { parseDecimal } from '#/lib/decimal'
import type { IsoDate } from '#/lib/dates'
import type { OwnershipReason } from '#/server/db/schema'

/** All of a flat: shares are basis points and add up to this. */
export const WHOLE = 10000

export interface Share {
  userId: string
  /** Basis points: 5000 = 50 %. */
  share: number
}

/** One stored row: an owner's share in one period. */
export interface PeriodRow extends Share {
  validFrom: IsoDate
  /** Null for the current period. */
  validTo: IsoDate | null
  reason: OwnershipReason | null
}

/** The rows that share a start date: one split of the flat. */
export interface Period {
  validFrom: IsoDate
  validTo: IsoDate | null
  reason: OwnershipReason | null
  /** Larger shares first. */
  shares: Share[]
}

/** Groups rows into periods, newest first. */
export function groupPeriods(rows: readonly PeriodRow[]): Period[] {
  const byStart = new Map<IsoDate, Period>()
  for (const row of rows) {
    const period = byStart.get(row.validFrom) ?? {
      validFrom: row.validFrom,
      validTo: row.validTo,
      reason: row.reason,
      shares: [],
    }
    period.shares.push({ userId: row.userId, share: row.share })
    byStart.set(row.validFrom, period)
  }
  return [...byStart.values()]
    .map((p) => ({
      ...p,
      shares: [...p.shares].sort((a, b) => b.share - a.share),
    }))
    .sort((a, b) => (a.validFrom < b.validFrom ? 1 : -1))
}

/** The split on a date, or no shares when no period contains it. */
export function sharesOn(periods: readonly Period[], date: IsoDate): Share[] {
  const period = periods.find(
    (p) => p.validFrom <= date && (p.validTo === null || date <= p.validTo),
  )
  return period?.shares ?? []
}

export type SplitProblem =
  | 'ownership_shares_total'
  | 'ownership_share_invalid'
  | 'ownership_no_owner'
  | 'ownership_invalid'

/**
 * Checks a new split: every share a whole number of basis points between 0
 * and 10000, each person once, at least one share above 0 and the total
 * exactly 10000.
 */
export function validateSplit(
  entries: readonly Share[],
): SplitProblem | undefined {
  if (
    entries.some(
      (e) => !Number.isSafeInteger(e.share) || e.share < 0 || e.share > WHOLE,
    )
  ) {
    return 'ownership_share_invalid'
  }
  if (new Set(entries.map((e) => e.userId)).size !== entries.length) {
    return 'ownership_invalid'
  }
  if (!entries.some((e) => e.share > 0)) {
    return 'ownership_no_owner'
  }
  if (entries.reduce((sum, e) => sum + e.share, 0) !== WHOLE) {
    return 'ownership_shares_total'
  }
  return undefined
}

/** A change starts after the current period's start, and not after today. */
export function validateChangeDate(
  from: IsoDate,
  currentStart: IsoDate,
  today: IsoDate,
): 'ownership_date_too_early' | 'ownership_date_in_future' | undefined {
  if (from > today) {
    return 'ownership_date_in_future'
  }
  if (from <= currentStart) {
    return 'ownership_date_too_early'
  }
  return undefined
}

/**
 * The first period's start can move, but not past today or to the start of
 * the next period.
 */
export function validateFirstDate(
  date: IsoDate,
  nextStart: IsoDate | undefined,
  today: IsoDate,
): 'ownership_date_in_future' | 'ownership_date_too_late' | undefined {
  if (date > today) {
    return 'ownership_date_in_future'
  }
  if (nextStart !== undefined && date >= nextStart) {
    return 'ownership_date_too_late'
  }
  return undefined
}

/**
 * A share typed in percent, with a comma or a point and at most two
 * decimals, as basis points (`33,33` = 3333); undefined for anything else.
 */
export function parsePercent(text: string): number | undefined {
  const value = parseDecimal(text.replace('%', ''), 2)
  return value !== undefined && value <= WHOLE ? value : undefined
}

/**
 * Equal shares for everyone, the rounding remainder to the first:
 * three people get 3334, 3333 and 3333.
 */
export function equalSplit(userIds: readonly string[]): Share[] {
  const base = Math.floor(WHOLE / userIds.length)
  const remainder = WHOLE - base * userIds.length
  return userIds.map((userId, i) => ({
    userId,
    share: i === 0 ? base + remainder : base,
  }))
}
