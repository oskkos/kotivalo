// Names for the kinds of amounts, the financing charges and the treatments,
// in the user's language, and the kinds as they appear in URLs.
import { m } from '#/paraglide/messages.js'
import type {
  FinancingTreatment,
  RecurringAmountKind,
} from '#/server/db/schema'

/** The amounts with one sequence per flat; financing charges are several. */
export const KINDS = [
  'maintenance_charge',
] as const satisfies readonly RecurringAmountKind[]
export type SingleKind = (typeof KINDS)[number]

export const kindLabel: Record<RecurringAmountKind, () => string> = {
  maintenance_charge: () => m.amounts_maintenance_charge(),
  financing_charge: () => m.amounts_financing_charge(),
}

export const treatmentLabel: Record<FinancingTreatment, () => string> = {
  income_recognised: () => m.amounts_treatment_income_recognised(),
  capitalised: () => m.amounts_treatment_capitalised(),
}

/** A financing charge's name, or the term's word for the unnamed one. */
export const chargeLabel = (charge: { name: string | null }) =>
  charge.name ?? m.amounts_financing_charge()

/** The kind in a URL: `maintenance-charge`. */
export const kindSlug = (kind: SingleKind) => kind.replace('_', '-')

export function kindFromSlug(slug: string): SingleKind | undefined {
  return KINDS.find((kind) => kindSlug(kind) === slug)
}
