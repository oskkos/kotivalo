// What the year summary's server functions return to the pages (openspec:
// year-summary, design decision 5): computed views only, so other owners'
// ids, payment rows and tenancies outside the year never reach the browser.
import type { IsoDate } from '#/lib/dates'
import type { Check, FlatYear } from './summary'

/** A flat's card on the year summary page. */
export interface FlatCard {
  propertyId: string
  streetAddress: string
  housingCompanyName: string | null
  businessId: string | null
  /** Basis points at the end of the holder's period in the year. */
  share: number
  /** Row 2.1, cents. */
  income: number
  /** Rows 2.2–2.5 summed, cents. */
  costs: number
  checks: Check[]
  /** The whole flats' owners with their shares; empty for one owner. */
  owners: CardOwner[]
}

/** An owner on a whole flat's card. */
export interface CardOwner {
  name: string
  /** Basis points at the end of the year or of their period. */
  share: number
  isYou: boolean
}

/** Whose figures are shown. */
export type HolderView =
  | { kind: 'own' }
  | { kind: 'whole' }
  | { kind: 'person'; userId: string; name: string }

export interface YearSummaryView {
  /** Whose figures the cards are. */
  holder: HolderView
  /** Another owner in the year, for the sheet; sorted by name. */
  people: { userId: string; name: string; flats: number }[]
  /** The flats in the own summary and in the whole flats. */
  counts: { own: number; whole: number }
  /** False when the holder has no years of their own and the whole flats' are used. */
  holderHasYears: boolean
  /** Today in Finland. */
  today: IsoDate
  year: number
  /** Oldest first; empty without a share in any flat. */
  years: number[]
  /** The flats in the summary, unsorted: sort by address for display. */
  flats: FlatCard[]
  /** Flats the user can see without a share in the year. */
  notIncluded: { propertyId: string; streetAddress: string }[]
}

/** The flat's address as form 7H's page shows it. */
export interface FlatAddress {
  id: string
  streetAddress: string
  postcode: string
  city: string
}

/** An owner of the whole flat, with their row 2.1. */
export interface FlatOwner extends CardOwner {
  userId: string
  /** Row 2.1 at their share, cents. */
  income: number
}

export type FlatYearView =
  | {
      ok: true
      today: IsoDate
      year: number
      property: FlatAddress
      holder: HolderView
      /** The whole flat's owners, empty for one owner. */
      owners: FlatOwner[]
      /** Null when the holder had no share in the flat in the year. */
      flat: Omit<FlatYear, 'propertyId' | 'included'> | null
    }
  | { ok: false; reason: 'property_not_found' }
