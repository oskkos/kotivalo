// The guide's drift check: pure functions over parsed input. The shell that
// reads the files is check-guide.ts.
import { requirementHash } from './hash.ts'
import type { Requirement } from '../traceability/spec.ts'

export interface Citation {
  spec: string
  name: string
  hash: string
}

export interface GuidePage {
  /** The page's path under docs/guide/src/content/docs, for messages. */
  page: string
  requirements: Citation[]
  /** The ids of its `<Shot>` tags. */
  shots: string[]
}

export interface Exclusion {
  spec: string
  name: string
  reason: string
}

export type ProblemKind =
  | 'stale'
  | 'unknown'
  | 'uncovered'
  | 'no_reason'
  | 'contradiction'
  | 'missing_shot'

export interface Problem {
  kind: ProblemKind
  spec: string
  name: string
  page?: string
  message: string
}

export interface GuideInput {
  /** The main specs. */
  main: Requirement[]
  /** The main specs with the active changes' deltas applied. */
  withChanges: Requirement[]
  pages: GuidePage[]
  exclusions: Exclusion[]
  /** The ids the capture scripts save. */
  savedShots: string[]
}

export interface GuideReport {
  /** Failures. */
  problems: Problem[]
  /** Added by an active change and not covered yet: reported, not failing. */
  pending: Problem[]
}

const key = (spec: string, name: string) => `${spec}\u0000${name}`

function index(requirements: Requirement[]): Map<string, Requirement> {
  return new Map(requirements.map((r) => [key(r.capability, r.name), r]))
}

export function checkGuide(input: GuideInput): GuideReport {
  const main = index(input.main)
  const changed = index(input.withChanges)
  const problems: Problem[] = []
  const pending: Problem[] = []

  const cited = new Set<string>()
  for (const page of input.pages) {
    for (const c of page.requirements) {
      const id = key(c.spec, c.name)
      cited.add(id)
      const hashes = [main.get(id), changed.get(id)]
        .filter((r): r is Requirement => r !== undefined)
        .map((r) => requirementHash(r.block))
      if (hashes.length === 0) {
        problems.push({
          kind: 'unknown',
          spec: c.spec,
          name: c.name,
          page: page.page,
          message: `${page.page} cites ${c.spec} "${c.name}", which no spec has`,
        })
      } else if (!hashes.includes(c.hash)) {
        problems.push({
          kind: 'stale',
          spec: c.spec,
          name: c.name,
          page: page.page,
          message: `${page.page} cites an old text of ${c.spec} "${c.name}" (now ${hashes[0]})`,
        })
      }
    }
    const saved = new Set(input.savedShots)
    for (const id of page.shots) {
      if (!saved.has(id)) {
        problems.push({
          kind: 'missing_shot',
          spec: '',
          name: id,
          page: page.page,
          message: `${page.page} shows the screenshot "${id}", which no capture script saves`,
        })
      }
    }
  }

  const excluded = new Set<string>()
  for (const e of input.exclusions) {
    const id = key(e.spec, e.name)
    excluded.add(id)
    if (!main.has(id) && !changed.has(id)) {
      problems.push({
        kind: 'unknown',
        spec: e.spec,
        name: e.name,
        message: `not-in-guide.json lists ${e.spec} "${e.name}", which no spec has`,
      })
      continue
    }
    if (e.reason.trim() === '') {
      problems.push({
        kind: 'no_reason',
        spec: e.spec,
        name: e.name,
        message: `not-in-guide.json lists ${e.spec} "${e.name}" without a reason`,
      })
    }
    if (cited.has(id)) {
      problems.push({
        kind: 'contradiction',
        spec: e.spec,
        name: e.name,
        message: `${e.spec} "${e.name}" is both cited by a page and listed in not-in-guide.json`,
      })
    }
  }

  for (const r of input.main) {
    const id = key(r.capability, r.name)
    if (!cited.has(id) && !excluded.has(id)) {
      problems.push({
        kind: 'uncovered',
        spec: r.capability,
        name: r.name,
        message: `${r.capability} "${r.name}" is neither cited by a page nor listed in not-in-guide.json`,
      })
    }
  }
  for (const r of input.withChanges) {
    const id = key(r.capability, r.name)
    if (!main.has(id) && !cited.has(id) && !excluded.has(id)) {
      pending.push({
        kind: 'uncovered',
        spec: r.capability,
        name: r.name,
        message: `${r.capability} "${r.name}" is added by an active change and not covered yet`,
      })
    }
  }

  return { problems, pending }
}
