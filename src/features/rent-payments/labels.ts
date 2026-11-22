// Texts for rent statuses and months (openspec: rent-payments). The month
// titles are whole messages per month, because Finnish puts the month in the
// genitive ("Marraskuun vuokra").
import { formatDate, formatDayMonth } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import type { RentStatus } from './status'

/** "Marraskuun vuokra" for `2026-11`. */
export function rentMonthTitle(month: string): string {
  const number = Number(month.slice(5, 7)) as
    1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
  return m.rent_month_title({ month: number })
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
    case 'rent_not_set':
      return m.rent_status_rent_not_set()
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
    case 'rent_not_set':
      return 'lavender'
  }
}

/** The due date with its year, for the month page. */
export const dueText = (dueDate: string) =>
  m.rent_month_due({ date: formatDate(dueDate) })
