// Texts for rent statuses and months (openspec: rent-payments). The month
// titles are whole messages per month, because Finnish puts the month in the
// genitive ("Marraskuun vuokra").
import { formatDate, formatDayMonth } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import type { RentStatus } from './status'

type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

const monthNumber = (month: string) => Number(month.slice(5, 7)) as MonthNumber

/** "Marraskuun vuokra" for `2026-11`. */
export function rentMonthTitle(month: string): string {
  return m.rent_month_title({ month: monthNumber(month) })
}

/** "Marraskuun vuokrat" for `2026-11`, the flats list's summary. */
export function rentSummaryTitle(month: string): string {
  return m.rent_summary_title({ month: monthNumber(month) })
}

/** The status as the rent card and the month page say it. */
export function statusText(status: RentStatus): string {
  switch (status.kind) {
    case 'due':
      return m.rent_status_due({ date: formatDayMonth(status.on) })
    case 'late':
      return m.rent_status_late({ days: status.days })
    case 'partly_paid':
      return m.rent_status_partly_paid()
    case 'paid':
      return m.rent_status_paid({ date: formatDayMonth(status.on) })
    case 'nothing_to_pay':
      return m.rent_status_nothing_to_pay()
    case 'rent_not_set':
      return m.rent_status_rent_not_set()
  }
}

/** The status on a flat's card: paid and partly paid without the details. */
export function cardStatusText(status: RentStatus): string {
  switch (status.kind) {
    case 'paid':
      return m.rent_short_paid()
    case 'partly_paid':
      return m.rent_short_partly_paid()
    default:
      return statusText(status)
  }
}

export type StatusTone = 'green' | 'yellow' | 'lavender' | 'late'

export function statusTone(status: RentStatus): StatusTone {
  switch (status.kind) {
    case 'paid':
      return 'green'
    case 'partly_paid':
      return 'yellow'
    case 'late':
      return 'late'
    case 'due':
    case 'nothing_to_pay':
    case 'rent_not_set':
      return 'lavender'
  }
}

/** The due date with its year, for the month page. */
export const dueText = (dueDate: string) =>
  m.rent_month_due({ date: formatDate(dueDate) })
