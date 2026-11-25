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
  /** Basis points at the end of the user's period in the year. */
  share: number
  /** Row 2.1, cents. */
  income: number
  /** Rows 2.2–2.5 summed, cents. */
  costs: number
  checks: Check[]
}

export interface YearSummaryView {
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

export type FlatYearView =
  | {
      ok: true
      today: IsoDate
      year: number
      property: FlatAddress
      /** Null when the user had no share in the flat in the year. */
      flat: Omit<FlatYear, 'propertyId' | 'included'> | null
    }
  | { ok: false; reason: 'property_not_found' }
