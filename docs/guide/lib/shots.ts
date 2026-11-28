// Screenshots in the guide: which ids a page shows and which the capture
// scripts save, and how a page finds its image (spec: "Screenshots in the
// guide").

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

/**
 * Finds the ids saved by more than one step, with the scripts that save them.
 * `scripts` maps a script's name to its source.
 */
export function duplicateShotIds(
  scripts: Record<string, string>,
): { id: string; scripts: string[] }[] {
  const owners = new Map<string, string[]>()
  for (const [name, source] of Object.entries(scripts)) {
    for (const id of shotIdsSaved(source)) {
      owners.set(id, [...(owners.get(id) ?? []), name])
    }
  }
  return [...owners]
    .filter(([, names]) => names.length > 1)
    .map(([id, names]) => ({ id, scripts: names }))
}

/**
 * Finds the screenshot `<language>/<id>.png` among the files the build found
 * (their paths end in that). A missing one throws in a strict build and is a
 * placeholder otherwise.
 */
export function shotFor<T>(
  files: Record<string, T>,
  id: string,
  language: string,
  strict: boolean,
): { kind: 'image'; src: T } | { kind: 'placeholder'; id: string } {
  const suffix = `/shots/${language}/${id}.png`
  const found = Object.keys(files).find((path) => path.endsWith(suffix))
  if (found !== undefined) {
    return { kind: 'image', src: files[found] }
  }
  if (strict) {
    throw new Error(
      `The guide shows the screenshot "${id}" (${language}), which no capture script saved`,
    )
  }
  return { kind: 'placeholder', id }
}
