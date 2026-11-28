// The words of a form 7H row and its parts, shared by the form 7H page and
// the year summary PDF.
import { kindLabel } from '#/features/recurring-amounts/labels'
import { categoryLabel, summaryRowLabel } from '#/features/transactions/labels'
import { chargeKindLabel } from '#/lib/charge-labels'
import { formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { withOriginal, type WithOriginal } from './original-text'
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

const fi = { locale: 'fi' } as const

/** The Finnish text of each row's name, for its original. */
const rowFinnish: Record<RowNumber, () => string> = {
  '2.1': () => m.transactions_row_gross_rent({}, fi),
  '2.2': () => m.transactions_row_maintenance_and_water({}, fi),
  '2.3': () => m.flat_tax_row_capital_charges({}, fi),
  '2.4': () => m.transactions_row_annual_repairs({}, fi),
  '2.5': () => m.transactions_row_other_costs({}, fi),
}

/** A row's name with its Finnish original (none in Finnish). */
export const rowOriginal = (row: RowNumber): WithOriginal =>
  withOriginal(rowLabel[row](), rowFinnish[row])

/** The parts that are tax terms; other parts get no original. */
const partFinnish: Partial<Record<PartKey, () => string>> = {
  maintenance_charge: () => m.amounts_maintenance_charge({}, fi),
  financing_charge: () => m.amounts_financing_charge({}, fi),
  annual_repair: () => m.transactions_category_annual_repair({}, fi),
}

/** A part's name with its original, when the part is a tax term. */
export const partOriginal = (key: PartKey): WithOriginal => {
  const finnish = partFinnish[key]
  const text = partLabel[key]()
  return finnish === undefined
    ? { text, original: null }
    : withOriginal(text, finnish)
}

/** The titles of the Not on form 7H card and the identity code label. */
export const outsideTitleOriginal = {
  capitalised: () =>
    withOriginal(m.flat_tax_outside_capitalised(), () =>
      m.flat_tax_outside_capitalised({}, fi),
    ),
  deposit_damage: () =>
    withOriginal(m.flat_tax_outside_deposit_damage(), () =>
      m.flat_tax_outside_deposit_damage({}, fi),
    ),
  improvements: () =>
    withOriginal(m.flat_tax_outside_improvements(), () =>
      m.flat_tax_outside_improvements({}, fi),
    ),
  identity_code: () =>
    withOriginal(m.flat_tax_identity_code(), () =>
      m.flat_tax_identity_code({}, fi),
    ),
} satisfies Record<string, () => WithOriginal>

/** The estimate's title, a tax term. */
export const estimateTitleOriginal = (): WithOriginal =>
  withOriginal(m.year_summary_estimate_tax_label(), () =>
    m.year_summary_estimate_tax_label({}, fi),
  )
