// Names for the kinds of amounts and the treatments, in the user's language,
// and the kinds as they appear in URLs.
import { m } from '#/paraglide/messages.js'
import type {
  FinancingTreatment,
  RecurringAmountKind,
} from '#/server/db/schema'

export const KINDS = [
  'rent',
  'maintenance_charge',
  'financing_charge',
] as const satisfies readonly RecurringAmountKind[]

export const kindLabel: Record<RecurringAmountKind, () => string> = {
  rent: () => m.amounts_rent(),
  maintenance_charge: () => m.amounts_maintenance_charge(),
  financing_charge: () => m.amounts_financing_charge(),
}

export const treatmentLabel: Record<FinancingTreatment, () => string> = {
  income_recognised: () => m.amounts_treatment_income_recognised(),
  capitalised: () => m.amounts_treatment_capitalised(),
}

/** The kind in a URL: `maintenance-charge`. */
export const kindSlug = (kind: RecurringAmountKind) => kind.replace('_', '-')

export function kindFromSlug(slug: string): RecurringAmountKind | undefined {
  return KINDS.find((kind) => kindSlug(kind) === slug)
}
