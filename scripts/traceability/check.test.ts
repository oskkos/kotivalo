import { describe, expect, test } from 'vitest'
import { check, pendingProblems, type TestCase } from './check.ts'
import type { Requirement } from './spec.ts'

const requirement = (
  name: string,
  scenarios: string[],
  noPlaywrightReason?: string,
): Requirement => ({
  capability: 'property',
  name,
  scenarios,
  ...(noPlaywrightReason === undefined ? {} : { noPlaywrightReason }),
})

const vitest = (...titlePath: string[]): TestCase => ({
  runner: 'vitest',
  titlePath,
  file: 'src/x.test.ts',
})
const playwright = (...titlePath: string[]): TestCase => ({
  runner: 'playwright',
  titlePath,
  file: 'e2e/x.spec.ts',
})

const messages = (requirements: Requirement[], tests: TestCase[]) =>
  check(requirements, tests).map((p) => p.message)

describe('check', () => {
  test('passes when every scenario has a test and a Playwright test exists', () => {
    expect(
      messages(
        [
          requirement('Add a property', [
            'Owner adds a flat',
            'Missing address',
          ]),
        ],
        [
          playwright('Add a property', 'Owner adds a flat'),
          vitest('Add a property', 'Missing address'),
        ],
      ),
    ).toEqual([])
  })

  test('reports a scenario without a test', () => {
    expect(
      messages(
        [
          requirement('Add a property', [
            'Owner adds a flat',
            'Missing address',
          ]),
        ],
        [playwright('Add a property', 'Owner adds a flat')],
      ),
    ).toEqual([
      `scenario "Missing address" has no test: add test('Missing address') inside describe('Add a property')`,
    ])
  })

  test('requires the scenario test to be inside the requirement describe', () => {
    expect(
      messages(
        [requirement('Add a property', ['Owner adds a flat'], 'reason')],
        [vitest('Something else', 'Owner adds a flat')],
      ),
    ).toHaveLength(1)
  })

  test('accepts nested describe blocks', () => {
    expect(
      messages(
        [requirement('Add a property', ['Owner adds a flat'])],
        [playwright('property', 'Add a property', 'form', 'Owner adds a flat')],
      ),
    ).toEqual([])
  })

  test('reports a requirement without a Playwright test or a reason', () => {
    expect(
      messages(
        [requirement('Add a property', ['Owner adds a flat'])],
        [vitest('Add a property', 'Owner adds a flat')],
      ),
    ).toEqual([
      `no Playwright test: add test.describe('Add a property') in e2e/, or record why with "**No Playwright test:** <reason>"`,
    ])
  })

  test('accepts a recorded reason instead of a Playwright test', () => {
    expect(
      messages(
        [requirement('Rounding', ['Half cents round up'], 'pure calculation')],
        [vitest('Rounding', 'Half cents round up')],
      ),
    ).toEqual([])
  })

  test('reports an empty reason', () => {
    expect(
      messages(
        [requirement('Rounding', ['Half cents round up'], '')],
        [vitest('Rounding', 'Half cents round up')],
      ),
    ).toEqual(['"**No Playwright test:**" needs a reason'])
  })

  test('reports a requirement without scenarios', () => {
    expect(messages([requirement('Rounding', [], 'reason')], [])).toEqual([
      'requirement has no scenarios',
    ])
  })

  test('reports duplicate requirement names across specs', () => {
    const tests = [playwright('Add', 'S')]
    const problems = check(
      [
        requirement('Add', ['S']),
        { ...requirement('Add', ['S']), capability: 'tenancy' },
      ],
      tests,
    )
    expect(problems.map((p) => p.capability)).toEqual(['tenancy'])
    expect(problems[0]?.message).toMatch(/also used in "property"/)
  })

  test('allows tests without a spec counterpart', () => {
    expect(
      messages([], [vitest('Router', 'registers the home route')]),
    ).toEqual([])
  })
})

describe('pendingProblems', () => {
  const p = (requirement: string, message: string) => ({
    capability: 'property',
    requirement,
    message,
  })

  test('keeps only problems that active changes add', () => {
    const main = [p('Add a flat', 'no Playwright test')]
    const withChanges = [
      p('Add a flat', 'no Playwright test'),
      p('Sign in', 'scenario "New address" has no test'),
    ]
    expect(pendingProblems(main, withChanges)).toEqual([
      p('Sign in', 'scenario "New address" has no test'),
    ])
  })

  test('is empty when the changes add no problems', () => {
    const main = [p('Add a flat', 'no Playwright test')]
    expect(pendingProblems(main, main)).toEqual([])
  })
})
