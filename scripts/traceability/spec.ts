// Reads OpenSpec specs (openspec/specs/<capability>/spec.md) and the delta
// specs of active changes (openspec/changes/<change>/specs/<capability>/spec.md)
// into requirements with their scenarios.

export interface Requirement {
  capability: string
  name: string
  scenarios: string[]
  /** Set when the requirement records why it has no Playwright test. */
  noPlaywrightReason?: string
}

const REQUIREMENT = /^###\s+Requirement:\s*(.+?)\s*$/
const SCENARIO = /^####\s+Scenario:\s*(.+?)\s*$/
const SECTION = /^##\s+(.+?)\s*$/
const FENCE = /^\s*(```|~~~)/
// The recorded reason for a requirement that can't be tested in a browser:
//   **No Playwright test:** <reason>
export const NO_PLAYWRIGHT = /^\*\*No Playwright test:\*\*\s*(.*?)\s*$/

/** Lines outside fenced code blocks, so examples in specs are not parsed. */
function proseLines(markdown: string): string[] {
  let inFence = false
  return markdown.split(/\r?\n/).map((line) => {
    if (FENCE.test(line)) {
      inFence = !inFence
      return ''
    }
    return inFence ? '' : line
  })
}

/** Requirements in a block of lines, in order. */
function parseRequirements(lines: string[], capability: string): Requirement[] {
  const requirements: Requirement[] = []
  let current: Requirement | undefined
  for (const line of lines) {
    const requirement = REQUIREMENT.exec(line)
    if (requirement) {
      current = { capability, name: requirement[1], scenarios: [] }
      requirements.push(current)
      continue
    }
    if (!current) continue
    const scenario = SCENARIO.exec(line)
    if (scenario) {
      current.scenarios.push(scenario[1])
      continue
    }
    const reason = NO_PLAYWRIGHT.exec(line.trim())
    if (reason) current.noPlaywrightReason = reason[1]
  }
  return requirements
}

/** A main spec: openspec/specs/<capability>/spec.md. */
export function parseSpec(markdown: string, capability: string): Requirement[] {
  return parseRequirements(proseLines(markdown), capability)
}

export interface Delta {
  added: Requirement[]
  modified: Requirement[]
  removed: string[]
  renamed: { from: string; to: string }[]
}

const RENAME = /^\s*-\s*(FROM|TO):\s*`?\s*###\s+Requirement:\s*(.+?)\s*`?\s*$/

/** A delta spec of an active change, split by its ## sections. */
export function parseDelta(markdown: string, capability: string): Delta {
  const sections = new Map<string, string[]>()
  let section = ''
  for (const line of proseLines(markdown)) {
    const heading = SECTION.exec(line)
    if (heading) {
      section = heading[1].toUpperCase()
      continue
    }
    const lines = sections.get(section) ?? []
    lines.push(line)
    sections.set(section, lines)
  }
  const block = (name: string) => sections.get(`${name} REQUIREMENTS`) ?? []

  const renamed: Delta['renamed'] = []
  let from: string | undefined
  for (const line of block('RENAMED')) {
    const match = RENAME.exec(line)
    if (!match) continue
    if (match[1] === 'FROM') from = match[2]
    else if (from !== undefined) {
      renamed.push({ from, to: match[2] })
      from = undefined
    }
  }

  return {
    added: parseRequirements(block('ADDED'), capability),
    modified: parseRequirements(block('MODIFIED'), capability),
    removed: parseRequirements(block('REMOVED'), capability).map((r) => r.name),
    renamed,
  }
}

/**
 * Applies a delta the way `openspec archive` does: renames first, then
 * removals, modifications (replace by name) and additions.
 */
export function applyDelta(
  requirements: Requirement[],
  delta: Delta,
): Requirement[] {
  let result = requirements.map((r) => {
    const rename = delta.renamed.find((n) => n.from === r.name)
    return rename ? { ...r, name: rename.to } : r
  })
  result = result.filter((r) => !delta.removed.includes(r.name))
  result = result.map((r) => delta.modified.find((m) => m.name === r.name) ?? r)
  const known = new Set(result.map((r) => r.name))
  // A MODIFIED requirement missing from the base is treated as added.
  const extra = [...delta.modified, ...delta.added].filter(
    (r) => !known.has(r.name),
  )
  return [...result, ...extra]
}
