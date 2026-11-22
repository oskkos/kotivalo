// Spec-to-test traceability (CLAUDE.md, "Specs and tests"): every OpenSpec
// scenario has a test, every requirement has a Playwright test or a recorded
// reason. Tests are listed by Vitest and Playwright without running them.
//
// The main specs (openspec/specs/) block. Active changes are reported as
// pending, so a proposal can be committed before its tests; archiving the
// change moves its specs into the main specs, where they block. A main-spec
// gap that an active change removes (a scenario it drops or renames) doesn't
// block, so the implementation can land before the archive. A change
// whose tasks are all done but that is not archived blocks too.
//
// Usage: pnpm check:traceability
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { allTasksDone } from './traceability/changes.ts'
import {
  blockingProblems,
  check,
  pendingProblems,
  type TestCase,
} from './traceability/check.ts'
import {
  applyDelta,
  parseDelta,
  parseSpec,
  type Requirement,
} from './traceability/spec.ts'

const ROOT = join(import.meta.dirname, '..')
const SPECS = join(ROOT, 'openspec/specs')
const CHANGES = join(ROOT, 'openspec/changes')

function capabilities(dir: string): string[] {
  if (!existsSync(dir)) {
    return []
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'spec.md')))
    .map((d) => d.name)
    .sort()
}

function readSpecs(): Map<string, Requirement[]> {
  const byCapability = new Map<string, Requirement[]>()
  for (const capability of capabilities(SPECS)) {
    const markdown = readFileSync(join(SPECS, capability, 'spec.md'), 'utf8')
    byCapability.set(capability, parseSpec(markdown, capability))
  }
  return byCapability
}

/** Active (not archived) changes, by name. */
function activeChanges(): string[] {
  return existsSync(CHANGES)
    ? readdirSync(CHANGES, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== 'archive')
        .map((d) => d.name)
        .sort()
    : []
}

/** Main specs with the deltas of the active changes applied. */
function withChanges(
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

/** Changes whose tasks are all checked: they should have been archived. */
function unarchivedDoneChanges(changes: string[]): string[] {
  return changes.filter((change) => {
    const tasks = join(CHANGES, change, 'tasks.md')
    return existsSync(tasks) && allTasksDone(readFileSync(tasks, 'utf8'))
  })
}

function run(command: string, args: string[]): string {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
}

interface VitestListed {
  name: string
  file: string
}

function vitestTests(): TestCase[] {
  const dir = mkdtempSync(join(tmpdir(), 'traceability-'))
  try {
    const out = join(dir, 'vitest.json')
    run('pnpm', ['exec', 'vitest', 'list', `--json=${out}`])
    const listed = JSON.parse(readFileSync(out, 'utf8')) as VitestListed[]
    return listed.map((t) => ({
      runner: 'vitest',
      titlePath: t.name.split(' > '),
      file: relative(ROOT, t.file),
    }))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

interface PlaywrightSuite {
  title: string
  file: string
  specs?: {
    title: string
    file: string
    tests: { expectedStatus: string }[]
  }[]
  suites?: PlaywrightSuite[]
}

function playwrightTests(): TestCase[] {
  const report = JSON.parse(
    run('pnpm', ['exec', 'playwright', 'test', '--list', '--reporter=json']),
  ) as { suites: PlaywrightSuite[] }
  const tests: TestCase[] = []
  // The top-level suites are files; their titles are not describe blocks.
  const walk = (suite: PlaywrightSuite, path: string[]) => {
    for (const spec of suite.specs ?? []) {
      // test.skip() and test.fixme() are listed with expectedStatus "skipped".
      if (spec.tests.every((t) => t.expectedStatus === 'skipped')) {
        continue
      }
      tests.push({
        runner: 'playwright',
        titlePath: [...path, spec.title],
        file: join('e2e', spec.file),
      })
    }
    for (const child of suite.suites ?? []) {
      walk(child, [...path, child.title])
    }
  }
  for (const file of report.suites) {
    walk(file, [])
  }
  return tests
}

const mainSpecs = readSpecs()
const changes = activeChanges()
const requirements = [...mainSpecs.values()].flat()
const tests = [...vitestTests(), ...playwrightTests()]
const mainProblems = check(requirements, tests)
const changedProblems = check(withChanges(mainSpecs, changes), tests)
const problems = blockingProblems(mainProblems, changedProblems)
const pending = pendingProblems(mainProblems, changedProblems)
const superseded = mainProblems.length - problems.length
const unarchived = unarchivedDoneChanges(changes)

const scenarios = requirements.reduce((n, r) => n + r.scenarios.length, 0)
console.log(
  `Traceability: ${String(requirements.length)} requirements, ${String(scenarios)} scenarios, ${String(tests.length)} tests.`,
)
if (pending.length > 0) {
  console.log(
    `\nPending in active changes (${changes.join(', ')}), not blocking until archived:`,
  )
  for (const p of pending) {
    console.log(`  · ${p.capability} › ${p.requirement}: ${p.message}`)
  }
  console.log('')
}
if (superseded > 0) {
  console.log(
    `${String(superseded)} main-spec gap(s) removed by active changes, not blocking.\n`,
  )
}
for (const change of unarchived) {
  console.error(
    `✗ change "${change}" has every task done but is not archived: run openspec archive ${change}`,
  )
}
for (const p of problems) {
  console.error(`✗ ${p.capability} › ${p.requirement}: ${p.message}`)
}
const blocking = problems.length + unarchived.length
if (blocking > 0) {
  console.error(`\n${String(blocking)} problem(s).`)
  process.exit(1)
}
console.log('✓ Every scenario has a test and every requirement is covered.')
