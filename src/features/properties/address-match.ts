// The street address typed to confirm deleting a flat (openspec: properties,
// "Confirming the deletion of a flat"). It guards against a slip of the
// finger, not an attacker, so it is checked in the browser only.

const normalise = (text: string) =>
  text.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('fi-FI')

/** Whether the typed text is the street address, ignoring case and extra spaces. */
export function addressMatches(typed: string, streetAddress: string): boolean {
  return normalise(typed) === normalise(streetAddress)
}
