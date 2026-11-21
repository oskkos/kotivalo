// Names for entry categories in the user's language.
import { m } from '#/paraglide/messages.js'
import type { TransactionCategory } from '#/server/db/schema'

export const categoryLabel: Record<TransactionCategory, () => string> = {
  tenant_water_charge: () => m.transactions_category_tenant_water_charge(),
  other_income: () => m.transactions_category_other_income(),
  annual_repair: () => m.transactions_category_annual_repair(),
  water_charge: () => m.transactions_category_water_charge(),
  insurance: () => m.transactions_category_insurance(),
  other_expense: () => m.transactions_category_other_expense(),
}
