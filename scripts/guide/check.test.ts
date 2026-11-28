import { describe, expect, test } from 'vitest'
import { checkGuide, type GuideInput, type GuidePage } from './check.ts'
import { requirementHash } from './hash.ts'
import { parseSpec, type Requirement } from '../traceability/spec.ts'

const SPEC = `## Requirements
### Requirement: Sign in with an emailed code
The user SHALL sign in with a code.

#### Scenario: The code step
- **WHEN** the user asks for a code
- **THEN** it is emailed
`

const requirements = (markdown: string, capability = 'authentication') =>
  parseSpec(markdown, capability)

const hashOf = (r: Requirement) => requirementHash(r.block)

const page = (
  cited: Requirement[],
  hashes: string[] = cited.map(hashOf),
  shots: string[] = [],
): GuidePage => ({
  page: 'kirjautuminen.mdx',
  requirements: cited.map((r, i) => ({
    spec: r.capability,
    name: r.name,
    hash: hashes[i],
  })),
  shots,
})

const input = (over: Partial<GuideInput>): GuideInput => ({
  main: [],
  withChanges: over.main ?? [],
  pages: [],
  exclusions: [],
  savedShots: [],
  ...over,
})

const kinds = (i: GuideInput) => checkGuide(i).problems.map((p) => p.kind)

describe('Guide pages cite their requirements', () => {
  const main = requirements(SPEC)

  test('A page with current hashes', () => {
    expect(kinds(input({ main, pages: [page(main)] }))).toEqual([])
  })

  test('A changed requirement', () => {
    const reworded = requirements(
      SPEC.replace('it is emailed', 'it is sent by email'),
    )
    const report = checkGuide(input({ main: reworded, pages: [page(main)] }))
    expect(report.problems.map((p) => [p.kind, p.page])).toEqual([
      ['stale', 'kirjautuminen.mdx'],
    ])
  })

  test('Whitespace alone is not a change', () => {
    const rewrapped = requirements(
      SPEC.replace('SHALL sign in', 'SHALL\n  sign   in').replace(
        '- **WHEN** the user',
        '- **WHEN**   the\n user',
      ),
    )
    expect(hashOf(rewrapped[0])).toBe(hashOf(main[0]))
    expect(kinds(input({ main: rewrapped, pages: [page(main)] }))).toEqual([])
  })

  test('A renamed requirement', () => {
    const old = { ...main[0], name: 'Sign in' }
    expect(
      kinds(input({ main, pages: [page([old], [hashOf(main[0])])] })),
    ).toEqual(['unknown', 'uncovered'])
  })

  test('A hash from an active change', () => {
    const modified = requirements(
      SPEC.replace('it is emailed', 'it is emailed at once'),
    )
    expect(
      kinds(
        input({
          main,
          withChanges: modified,
          pages: [page(modified)],
        }),
      ),
    ).toEqual([])
  })

  test('A hash is 12 hex digits', () => {
    expect(hashOf(main[0])).toMatch(/^[0-9a-f]{12}$/)
  })

  test('A screenshot that no capture script saves', () => {
    const shown = page(main, undefined, ['flat-list', 'flat-form'])
    const report = checkGuide(
      input({ main, pages: [shown], savedShots: ['flat-list'] }),
    )
    expect(report.problems.map((p) => [p.kind, p.name])).toEqual([
      ['missing_shot', 'flat-form'],
    ])
  })
})

describe('User-facing requirements covered by the guide', () => {
  const main = requirements(
    `${SPEC}
### Requirement: Limiting code requests
Requests SHALL be limited.

#### Scenario: Too many
- **WHEN** many
- **THEN** refused
`,
  )
  const [signIn, limit] = main
  const left = (r: Requirement, reason = 'A limit.') => ({
    spec: r.capability,
    name: r.name,
    reason,
  })

  test('An uncovered requirement', () => {
    const report = checkGuide(input({ main, pages: [page([signIn])] }))
    expect(report.problems.map((p) => [p.kind, p.name])).toEqual([
      ['uncovered', 'Limiting code requests'],
    ])
  })

  test('A requirement left out with a reason', () => {
    expect(
      kinds(
        input({ main, pages: [page([signIn])], exclusions: [left(limit)] }),
      ),
    ).toEqual([])
  })

  test('A left-out requirement without a reason', () => {
    expect(
      kinds(
        input({
          main,
          pages: [page([signIn])],
          exclusions: [left(limit, '  ')],
        }),
      ),
    ).toEqual(['no_reason'])
  })

  test('A left-out requirement that no longer exists', () => {
    const gone = { spec: 'authentication', name: 'Gone', reason: 'A limit.' }
    expect(
      kinds(
        input({
          main,
          pages: [page([signIn, limit])],
          exclusions: [gone],
        }),
      ),
    ).toEqual(['unknown'])
  })

  test('Cited and left out', () => {
    expect(
      kinds(
        input({
          main,
          pages: [page(main)],
          exclusions: [left(limit)],
        }),
      ),
    ).toEqual(['contradiction'])
  })

  test('A requirement added by an active change', () => {
    const added = requirements(
      `### Requirement: Statistics of the year
It SHALL show statistics.

#### Scenario: Shown
- **WHEN** opened
- **THEN** shown
`,
    )
    const report = checkGuide(
      input({
        main,
        withChanges: [...main, ...added],
        pages: [page([signIn, limit])],
      }),
    )
    expect(report.problems).toEqual([])
    expect(report.pending.map((p) => p.name)).toEqual([
      'Statistics of the year',
    ])
  })
})
