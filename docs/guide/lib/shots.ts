// Screenshot ids: which a page shows and which the capture scripts save.

const SHOT_TAG = /<Shot\b[^>]*?\bid=["']([^"']+)["']/g
const SHOT_CALL = /\bshot\(\s*\w+\s*,\s*['"`]([^'"`]+)['"`]/g

function matches(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((m) => m[1])
}

/** The ids of the `<Shot id="…" />` tags in a page. */
export function shotIdsShown(page: string): string[] {
  return matches(page, SHOT_TAG)
}

/** The ids a capture script saves with `shot(page, '<id>')`. */
export function shotIdsSaved(script: string): string[] {
  return matches(script, SHOT_CALL)
}
