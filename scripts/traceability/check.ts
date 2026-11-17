import type { Requirement } from './spec.ts'

export type Runner = 'vitest' | 'playwright'

/** One test, as listed by its runner. Skipped and todo tests are not listed. */
export interface TestCase {
  runner: Runner
  /** Titles from the outermost describe to the test itself; joined with
   * " > " when matching. */
  titlePath: string[]
  file: string
}

export interface Problem {
  capability: string
  requirement: string
  message: string
}

// Vitest lists a test as one name joined with " > ", so a title that contains
// " > " can't be split back reliably. Matching is done on the joined path.
const SEP = ' > '

/** describe(requirement) at any level, with a describe or test inside it. */
function underRequirement(test: TestCase, requirement: string) {
  const path = test.titlePath.join(SEP)
  return (
    path.startsWith(requirement + SEP) || path.includes(SEP + requirement + SEP)
  )
}

/** test(scenario) somewhere inside describe(requirement). */
function covers(test: TestCase, requirement: string, scenario: string) {
  return (
    test.titlePath.join(SEP).endsWith(SEP + scenario) &&
    underRequirement(test, requirement)
  )
}

/**
 * Every scenario needs a test, and every requirement needs a Playwright test
 * or a recorded reason. Tests without a spec counterpart are allowed.
 */
export function check(
  requirements: Requirement[],
  tests: TestCase[],
): Problem[] {
  const problems: Problem[] = []
  const problem = (r: Requirement, message: string) =>
    problems.push({ capability: r.capability, requirement: r.name, message })

  const seen = new Map<string, string>()
  for (const r of requirements) {
    const other = seen.get(r.name)
    if (other !== undefined) {
      problem(
        r,
        `requirement name is also used in "${other}"; names must be unique because tests match them by name`,
      )
    }
    seen.set(r.name, r.capability)

    if (r.scenarios.length === 0) problem(r, 'requirement has no scenarios')
    for (const scenario of r.scenarios) {
      if (!tests.some((t) => covers(t, r.name, scenario))) {
        problem(
          r,
          `scenario "${scenario}" has no test: add test('${scenario}') inside describe('${r.name}')`,
        )
      }
    }

    if (r.noPlaywrightReason !== undefined) {
      if (r.noPlaywrightReason === '') {
        problem(r, '"**No Playwright test:**" needs a reason')
      }
    } else if (
      !tests.some(
        (t) => t.runner === 'playwright' && underRequirement(t, r.name),
      )
    ) {
      problem(
        r,
        `no Playwright test: add test.describe('${r.name}') in e2e/, or record why with "**No Playwright test:** <reason>"`,
      )
    }
  }
  return problems
}
