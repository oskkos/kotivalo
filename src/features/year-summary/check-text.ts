// The words of a check, shared by the form 7H page and the year summary PDF.
import {
  formatDate,
  formatList,
  formatMoney,
  formatMonth,
  formatShare,
} from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import type { Check } from './summary'

const monthName = (month: string) => {
  const [year, number] = month.split('-').map(Number) as [number, number]
  return formatMonth(year, number)
}

/**
 * A check's title and explanation. `own` words a share change as the
 * reader's own; `pdf` writes the change with a dash, because the PDF's
 * standard font has no arrow.
 */
export function checkText(
  check: Check,
  options: { own: boolean; pdf?: boolean },
): { title: string; text: string } {
  switch (check.kind) {
    case 'unpaid':
      return {
        title: m.flat_tax_check_unpaid_title({
          months: formatList(check.months.map(monthName)),
        }),
        text: m.flat_tax_check_unpaid_text(),
      }
    case 'partly_paid':
      return {
        title: m.flat_tax_check_partly_paid_title({
          months: formatList(
            check.months.map((row) =>
              m.flat_tax_check_partly_paid_month({
                month: monthName(row.month),
                amount: formatMoney(row.missing),
              }),
            ),
          ),
        }),
        text: m.flat_tax_check_partly_paid_text(),
      }
    case 'vacant':
      return {
        title: m.flat_tax_check_vacant_title({
          months: formatList(check.months.map(monthName)),
        }),
        text: m.flat_tax_check_vacant_text(),
      }
    case 'details_missing':
      return {
        title: m.flat_tax_check_details_missing_title(),
        text: m.flat_tax_check_details_missing_text(),
      }
    case 'treatment_not_set':
      return {
        title: m.flat_tax_check_treatment_title({ count: check.months.length }),
        text: m.flat_tax_check_treatment_text(),
      }
    case 'share_changed': {
      const values = {
        date: formatDate(check.on),
        from: formatShare(check.from),
        to: formatShare(check.to),
      }
      const title = options.pdf
        ? options.own
          ? m.pdf_check_share_title(values)
          : m.pdf_check_share_person_title(values)
        : options.own
          ? m.flat_tax_check_share_title(values)
          : m.flat_tax_check_share_person_title(values)
      return {
        title,
        text: options.own
          ? m.flat_tax_check_share_text()
          : m.flat_tax_check_share_person_text(),
      }
    }
  }
}
