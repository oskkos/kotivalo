/** The first character of a display name, for the round account button. */
export function initialOf(name: string): string {
  // Array.from splits by code point, so an emoji or Å stays whole.
  return (Array.from(name.trim())[0] ?? '').toLocaleUpperCase()
}
