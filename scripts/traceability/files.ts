// Reads the OpenSpec specs from disk: the main specs and the active changes'
// deltas applied on top of them. Shared by the traceability and guide checks.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { applyDelta, parseDelta, parseSpec, type Requirement } from './spec.ts'

export const ROOT = join(import.meta.dirname, '../..')
export const SPECS = join(ROOT, 'openspec/specs')
export const CHANGES = join(ROOT, 'openspec/changes')

export function capabilities(dir: string): string[] {
  if (!existsSync(dir)) {
    return []
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'spec.md')))
    .map((d) => d.name)
    .sort()
}

export function readSpecs(): Map<string, Requirement[]> {
  const byCapability = new Map<string, Requirement[]>()
  for (const capability of capabilities(SPECS)) {
    const markdown = readFileSync(join(SPECS, capability, 'spec.md'), 'utf8')
    byCapability.set(capability, parseSpec(markdown, capability))
  }
  return byCapability
}

/** Active (not archived) changes, by name. */
export function activeChanges(): string[] {
  return existsSync(CHANGES)
    ? readdirSync(CHANGES, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== 'archive')
        .map((d) => d.name)
        .sort()
    : []
}

/** Main specs with the deltas of the active changes applied. */
export function withChanges(
  main: Map<string, Requirement[]>,
  changes: string[],
): Requirement[] {
  const byCapability = new Map(main)
  for (const change of changes) {
    const dir = join(CHANGES, change, 'specs')
    for (const capability of capabilities(dir)) {
      const markdown = readFileSync(join(dir, capability, 'spec.md'), 'utf8')
      const delta = parseDelta(markdown, capability)
      byCapability.set(
        capability,
        applyDelta(byCapability.get(capability) ?? [], delta),
      )
    }
  }
  return [...byCapability.values()].flat()
}
