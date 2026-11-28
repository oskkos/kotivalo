// The guide's drift check (openspec/changes/add-user-guide, design.md,
// decision 3): the pages' requirement hashes against the specs, and the
// requirements no page covers. Reads files only; no build.
//
// Usage: pnpm guide:check [--json]
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parse } from 'yaml'
import { shotIdsSaved, shotIdsShown } from '../docs/guide/lib/shots.ts'
import {
  activeChanges,
  readSpecs,
  ROOT,
  withChanges,
} from './traceability/files.ts'
import {
  checkGuide,
  type Citation,
  type Exclusion,
  type GuidePage,
} from './guide/check.ts'

const GUIDE = join(ROOT, 'docs/guide')
const PAGES = join(GUIDE, 'src/content/docs')
const CAPTURE = join(GUIDE, 'capture')

function filesUnder(dir: string, suffix: string): string[] {
  if (!existsSync(dir)) {
    return []
  }
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((d) => d.isFile() && d.name.endsWith(suffix))
    .map((d) => join(d.parentPath, d.name))
    .sort()
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/

function readPage(file: string): GuidePage {
  const source = readFileSync(file, 'utf8')
  const match = FRONTMATTER.exec(source)
  const data = (match ? parse(match[1]) : {}) as {
    requirements?: Citation[]
  } | null
  return {
    page: relative(PAGES, file),
    requirements: data?.requirements ?? [],
    shots: shotIdsShown(source),
  }
}

function readExclusions(): Exclusion[] {
  const file = join(GUIDE, 'not-in-guide.json')
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as Exclusion[])
    : []
}

const main = readSpecs()
const report = checkGuide({
  main: [...main.values()].flat(),
  withChanges: withChanges(main, activeChanges()),
  pages: filesUnder(PAGES, '.mdx').map(readPage),
  exclusions: readExclusions(),
  savedShots: filesUnder(CAPTURE, '.capture.ts').flatMap((f) =>
    shotIdsSaved(readFileSync(f, 'utf8')),
  ),
})

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  for (const p of report.pending) {
    console.log(`· pending: ${p.message}`)
  }
  for (const p of report.problems) {
    console.error(`✗ ${p.kind}: ${p.message}`)
  }
  if (report.problems.length === 0) {
    console.log('Guide: no drift.')
  }
}
process.exit(report.problems.length > 0 ? 1 : 0)
