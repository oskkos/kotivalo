// The words of a form 7H row and its parts, shared by the form 7H page and
// the year summary PDF.
import { kindLabel } from '#/features/recurring-amounts/labels'
import { categoryLabel, summaryRowLabel } from '#/features/transactions/labels'
import { chargeKindLabel } from '#/lib/charge-labels'
import { formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import type { ChargeKind } from '#/server/db/schema'
import type { Part, PartKey, RowNumber } from './summary'

export const rowLabel: Record<RowNumber, () => string> = {
  '2.1': () => summaryRowLabel.gross_rent(),
  '2.2': () => summaryRowLabel.maintenance_and_water(),
  '2.3': () => m.flat_tax_row_capital_charges(),
  '2.4': () => summaryRowLabel.annual_repairs(),
  '2.5': () => summaryRowLabel.other_costs(),
}

const usagePart = (kind: ChargeKind) => () =>
  m.flat_tax_part_usage({ kind: chargeKindLabel[kind]() })

/** Each part's name: usage charges are told apart from entries. */
const partLabel: Record<PartKey, () => string> = {
  rent_payments: () => m.rent_payments_title(),
  ...categoryLabel,
  maintenance_charge: kindLabel.maintenance_charge,
  financing_charge: kindLabel.financing_charge,
  deposit_damage: () => m.flat_tax_part_deposit_damage(),
  water: usagePart('water'),
  parking: usagePart('parking'),
  sauna: usagePart('sauna'),
  other: usagePart('other'),
}

export const partsText = (parts: readonly Part[]) =>
  parts
    .map((part) =>
      m.flat_tax_part({
        label: partLabel[part.key](),
        amount: formatMoney(part.cents),
      }),
    )
    // The app's separator for amounts on one line, as on the charges page.
    .join(' · ')
