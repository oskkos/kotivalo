// How ownership reads in the UI: reasons, splits ("Sinä 50 % · Jussi 50 %")
// and dates. Shared by the ownership components.
import { formatShare } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import type { OwnershipReason } from '#/server/db/schema'
import type { Share } from './periods'

export function reasonLabel(reason: OwnershipReason): string {
  switch (reason) {
    case 'sale':
      return m.ownership_reason_sale()
    case 'gift':
      return m.ownership_reason_gift()
    case 'inheritance':
      return m.ownership_reason_inheritance()
    case 'division':
      return m.ownership_reason_division()
    case 'other':
      return m.ownership_reason_other()
  }
}

/** The name to show: "Sinä" for the user, else the name. */
export function displayName(
  userId: string,
  names: Readonly<Record<string, string>>,
  you: string,
): string {
  return userId === you ? m.sharing_you() : (names[userId] ?? '')
}

/** A split as one line, larger shares first: "Sinä 50 % · Jussi 50 %". */
export function splitText(
  shares: readonly Share[],
  names: Readonly<Record<string, string>>,
  you: string,
): string {
  return [...shares]
    .filter((s) => s.share > 0)
    .sort((a, b) => b.share - a.share)
    .map((s) =>
      m.property_card_owner({
        name: displayName(s.userId, names, you),
        share: formatShare(s.share),
      }),
    )
    .join(' · ')
}
