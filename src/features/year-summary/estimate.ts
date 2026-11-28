// The rental income after costs and the capital income tax estimate
// (openspec: year-summary, "The capital income tax estimate"): pure, from the
// year summary's cards, so the page and the PDF show the same figures.
import type { Row, RowNumber } from './summary'
import type { FlatCard, HolderView } from './view'

/** The fixed rate: 30 % up to 30 000 € of capital income, 34 % above (#19). */
export const CAPITAL_INCOME_RATE_BASIS_POINTS = 3000
export const UPPER_RATE_BASIS_POINTS = 3400
export const CAPITAL_INCOME_LIMIT_CENTS = 3_000_000

export type EstimateKind = 'own' | 'loss' | 'person' | 'whole'

export interface YearEstimate {
  /** The cards' row 2.1 summed, cents. */
  income: number
  /** The cards' rows 2.2–2.5 summed, cents. */
  costs: number
  /** Income minus costs, cents; negative for a loss. */
  net: number
  /** Whole-euro cents; null for a loss and for another holder than the own share. */
  tax: number | null
  kind: EstimateKind
}

/** 30 % of a positive net, rounded half up to whole euros, in cents. */
export function capitalIncomeTax(net: number) {
  if (net <= 0) {
    return 0
  }
  // The rate in basis points of the net in whole euros (cents ÷ 100, basis
  // points ÷ 10 000), rounded half up.
  const euros = Math.floor(
    (net * CAPITAL_INCOME_RATE_BASIS_POINTS + 500_000) / 1_000_000,
  )
  return euros * 100
}

export function yearEstimate(
  cards: readonly FlatCard[],
  holder: HolderView,
): YearEstimate {
  const income = cards.reduce((sum, card) => sum + card.income, 0)
  const costs = cards.reduce((sum, card) => sum + card.costs, 0)
  const net = income - costs
  if (holder.kind !== 'own') {
    return { income, costs, net, tax: null, kind: holder.kind }
  }
  if (net < 0) {
    return { income, costs, net, tax: null, kind: 'loss' }
  }
  return { income, costs, net, tax: capitalIncomeTax(net), kind: 'own' }
}

/** A flat's rental income after costs: row 2.1 minus rows 2.2–2.5, cents. */
export function flatRentalIncomeAfterCosts(
  rows: Readonly<Record<RowNumber, Pick<Row, 'cents'>>>,
) {
  return (
    rows['2.1'].cents -
    rows['2.2'].cents -
    rows['2.3'].cents -
    rows['2.4'].cents -
    rows['2.5'].cents
  )
}
