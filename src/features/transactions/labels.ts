// Names for entry categories in the user's language.
import { m } from '#/paraglide/messages.js'
import type { TransactionCategory } from '#/server/db/schema'
import type { SummaryRow } from './categories'

export const categoryLabel: Record<TransactionCategory, () => string> = {
  tenant_water_charge: () => m.transactions_category_tenant_water_charge(),
  other_income: () => m.transactions_category_other_income(),
  annual_repair: () => m.transactions_category_annual_repair(),
  water_charge: () => m.transactions_category_water_charge(),
  insurance: () => m.transactions_category_insurance(),
  other_expense: () => m.transactions_category_other_expense(),
}

/** Form 7H rows, as the form names them. */
export const summaryRowLabel: Record<SummaryRow, () => string> = {
  gross_rent: () => m.transactions_row_gross_rent(),
  maintenance_and_water: () => m.transactions_row_maintenance_and_water(),
  annual_repairs: () => m.transactions_row_annual_repairs(),
  other_costs: () => m.transactions_row_other_costs(),
}

/** The receipt's address; `download` sends it as an attachment. */
export function receiptUrl(receiptId: string, download = false) {
  const path = `/api/receipts/${encodeURIComponent(receiptId)}`
  return download ? `${path}?download=1` : path
}
