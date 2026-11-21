// Entry categories and the form 7H row each one fills (openspec:
// transactions; design.md, "Categories map to form 7H rows"). Rows from the
// Tax Administration's 7H instructions, updated 4.2.2026. Pure data: the year
// summary (#34) imports it too.
import type { TransactionCategory, TransactionType } from '#/server/db/schema'

/**
 * Form 7H rows that entries fill. `capital_charges` (2.3) comes only from
 * the financing charge periods, so no category maps to it.
 */
export type SummaryRow =
  | 'gross_rent' // 2.1 Oma osuutesi bruttovuokratuloista
  | 'maintenance_and_water' // 2.2 Hoitovastikkeet ja vesimaksut
  | 'annual_repairs' // 2.4 Vuosikorjauskulut
  | 'other_costs' // 2.5 Muut kulut

export interface Category {
  type: TransactionType
  row: SummaryRow
}

export const CATEGORIES: Record<TransactionCategory, Category> = {
  tenant_water_charge: { type: 'income', row: 'gross_rent' },
  other_income: { type: 'income', row: 'gross_rent' },
  annual_repair: { type: 'expense', row: 'annual_repairs' },
  water_charge: { type: 'expense', row: 'maintenance_and_water' },
  insurance: { type: 'expense', row: 'other_costs' },
  other_expense: { type: 'expense', row: 'other_costs' },
}

/** A type's categories, in the order the form shows them. */
export function categoriesOf(type: TransactionType): TransactionCategory[] {
  return (Object.keys(CATEGORIES) as TransactionCategory[]).filter(
    (category) => CATEGORIES[category].type === type,
  )
}

/** Whether the category belongs to the type. */
export function categoryFits(
  type: TransactionType,
  category: TransactionCategory,
): boolean {
  return CATEGORIES[category].type === type
}
