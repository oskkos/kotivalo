// The form 7H row each usage charge kind fills in the year summary (openspec:
// usage-charges, "Usage charge rows on form 7H"). Water goes with the
// maintenance charges (2.2), named in the row; the rest are other costs (2.5),
// which the Tax Administration doesn't name (CONCEPT.md §4.5, #16).
import type { SummaryRow } from '#/features/transactions/categories'
import type { ChargeKind } from '#/server/db/schema'

export const USAGE_CHARGE_ROWS: Record<ChargeKind, SummaryRow> = {
  water: 'maintenance_and_water',
  parking: 'other_costs',
  sauna: 'other_costs',
  other: 'other_costs',
}
