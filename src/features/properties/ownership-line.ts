// The ownership line on a flat card (Design canvas: "Asunnot"): the current
// owners by share, the user as "You", and "shared with you" for a member.
import { formatShare } from '#/lib/format'
import { m } from '#/paraglide/messages.js'

export interface CardOwner {
  name: string
  /** Basis points. */
  share: number
  isYou: boolean
}

/** Empty when the flat has no recorded owners. */
export function ownershipLine(owners: readonly CardOwner[]): string {
  if (owners.length === 0) {
    return ''
  }
  const sorted = [...owners].sort(
    (a, b) => b.share - a.share || Number(b.isYou) - Number(a.isYou),
  )
  const parts = sorted.map((o) =>
    m.property_card_owner({
      name: o.isYou ? m.sharing_you() : o.name,
      share: formatShare(o.share),
    }),
  )
  if (!owners.some((o) => o.isYou)) {
    parts.push(m.property_card_shared_with_you())
  }
  return parts.join(' · ')
}
