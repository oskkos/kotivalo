// A usage charge's or tenant fee's kind and basis in the user's language
// (openspec: usage-charges, tenancies). Shared by both, because their kinds
// and bases are the same.
import { m } from '#/paraglide/messages.js'
import type { ChargeBasis, ChargeKind } from '#/server/db/schema'

export const chargeKindLabel: Record<ChargeKind, () => string> = {
  water: () => m.charge_kind_water(),
  parking: () => m.charge_kind_parking(),
  sauna: () => m.charge_kind_sauna(),
  other: () => m.charge_kind_other(),
}

export const chargeBasisLabel: Record<ChargeBasis, () => string> = {
  fixed: () => m.charge_basis_fixed(),
  per_occupant: () => m.charge_basis_per_occupant(),
}

/** What a charge is called: its description for `other`, else its kind. */
export function chargeName(charge: {
  kind: ChargeKind
  description: string | null
}): string {
  return charge.kind === 'other' && charge.description !== null
    ? charge.description
    : chargeKindLabel[charge.kind]()
}
