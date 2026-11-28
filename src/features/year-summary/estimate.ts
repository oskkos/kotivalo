// The rental income after costs and the capital income tax estimate
// (openspec: year-summary, "The capital income tax estimate"): pure, from the
// year summary's cards, so the page and the PDF show the same figures.
import type { FlatCard, HolderView } from './view'

/** The capital income tax rate below 30 000 €: 30 % (a fixed rate, #19). */
export const CAPITAL_INCOME_RATE = { numerator: 3, denominator: 10 } as const

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
  const { numerator, denominator } = CAPITAL_INCOME_RATE
  // The rate of the net in whole euros (cents ÷ 100), rounded half up.
  const euros = Math.floor(
    (net * numerator + (denominator * 100) / 2) / (denominator * 100),
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
