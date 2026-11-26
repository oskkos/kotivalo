// The `person` search parameter of the year summary pages (openspec:
// year-summary, "Choosing whose figures"): absent for the own share,
// `whole` for the whole flats, or another owner's user id.
import type { HolderView } from './view'

export const personParam = (holder: HolderView): string | undefined => {
  switch (holder.kind) {
    case 'own':
      return undefined
    case 'whole':
      return 'whole'
    case 'person':
      return holder.userId
  }
}
