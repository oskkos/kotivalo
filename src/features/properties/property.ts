// A flat as the rest of the app sees it (openspec: properties).

/** 1, 2, 3 or 4, where 4 means four rooms or more. */
export type RoomCount = 1 | 2 | 3 | 4
export const ROOM_COUNTS: readonly RoomCount[] = [1, 2, 3, 4]

export interface PropertyDetails {
  streetAddress: string
  /** Five digits. */
  postcode: string
  city: string
  roomCount: RoomCount
  /** In tenths of m²: 485 = 48,5 m². */
  floorArea: number
}

export interface Property extends PropertyDetails {
  id: string
}

/** A flat as one user sees it: when they archived it, if they did. */
export interface UserProperty extends Property {
  archivedAt: Date | null
}

/**
 * Sorts by street address in the language's alphabetical order, numbers by
 * value: "Kuusikuja 3" before "Kuusikuja 12", and in Finnish and Swedish
 * Å, Ä and Ö after Z.
 */
export function sortByStreetAddress<T extends Pick<Property, 'streetAddress'>>(
  items: readonly T[],
  locale: string,
): T[] {
  const collator = new Intl.Collator(locale, { numeric: true })
  return [...items].sort((a, b) =>
    collator.compare(a.streetAddress, b.streetAddress),
  )
}
