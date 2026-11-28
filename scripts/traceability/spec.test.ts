import { describe, expect, test } from 'vitest'
import { applyDelta, parseDelta, parseSpec } from './spec.ts'

const SPEC = `# property Specification

## Purpose
Flats the user owns or can see.

## Requirements
### Requirement: Add a property
The user SHALL be able to add a property.

#### Scenario: Owner adds a flat
- **WHEN** the user saves the form
- **THEN** the flat is listed

#### Scenario: Missing address
- **WHEN** the address is empty
- **THEN** an error is shown

### Requirement: Year summary rounding
Totals SHALL be rounded to whole cents.

**No Playwright test:** pure calculation, covered by unit tests.

#### Scenario: Half cents round up

\`\`\`md
### Requirement: Not a real requirement
#### Scenario: Inside a code block
\`\`\`
`

describe('parseSpec', () => {
  test('reads requirements with their scenarios', () => {
    expect(parseSpec(SPEC, 'property')).toEqual([
      {
        capability: 'property',
        name: 'Add a property',
        scenarios: ['Owner adds a flat', 'Missing address'],
        block: `### Requirement: Add a property
The user SHALL be able to add a property.

#### Scenario: Owner adds a flat
- **WHEN** the user saves the form
- **THEN** the flat is listed

#### Scenario: Missing address
- **WHEN** the address is empty
- **THEN** an error is shown`,
      },
      {
        capability: 'property',
        name: 'Year summary rounding',
        scenarios: ['Half cents round up'],
        block: `### Requirement: Year summary rounding
Totals SHALL be rounded to whole cents.

**No Playwright test:** pure calculation, covered by unit tests.

#### Scenario: Half cents round up`,
        noPlaywrightReason: 'pure calculation, covered by unit tests.',
      },
    ])
  })
})

const DELTA = `## ADDED Requirements
### Requirement: Archive a property
The user SHALL be able to archive a property.

#### Scenario: Archived flat is hidden

## MODIFIED Requirements
### Requirement: Add a property
The user SHALL be able to add a property with a housing company.

#### Scenario: Owner adds a flat with a housing company

## REMOVED Requirements
### Requirement: Year summary rounding
**Reason**: moved to the year-summary spec

## RENAMED Requirements
- FROM: \`### Requirement: Old name\`
- TO: \`### Requirement: New name\`
`

describe('parseDelta', () => {
  test('reads added, modified, removed and renamed requirements', () => {
    const delta = parseDelta(DELTA, 'property')
    expect(delta.added.map((r) => r.name)).toEqual(['Archive a property'])
    expect(delta.modified).toEqual([
      {
        capability: 'property',
        name: 'Add a property',
        scenarios: ['Owner adds a flat with a housing company'],
        block: `### Requirement: Add a property
The user SHALL be able to add a property with a housing company.

#### Scenario: Owner adds a flat with a housing company`,
      },
    ])
    expect(delta.removed).toEqual(['Year summary rounding'])
    expect(delta.renamed).toEqual([{ from: 'Old name', to: 'New name' }])
  })
})

describe('applyDelta', () => {
  test('applies renames, removals, modifications and additions', () => {
    const base = [
      ...parseSpec(SPEC, 'property'),
      {
        capability: 'property',
        name: 'Old name',
        scenarios: ['Kept'],
        block: '### Requirement: Old name',
      },
    ]
    const result = applyDelta(base, parseDelta(DELTA, 'property'))
    expect(result.map((r) => [r.name, r.scenarios])).toEqual([
      ['Add a property', ['Owner adds a flat with a housing company']],
      ['New name', ['Kept']],
      ['Archive a property', ['Archived flat is hidden']],
    ])
  })
})

describe('requirement blocks', () => {
  test('a block ends at the next ## section, not at the end of the file', () => {
    const [requirement] = parseSpec(
      `## Requirements
### Requirement: A
Text.

#### Scenario: S
- **THEN** ok

## Other
Not part of A.
`,
      'x',
    )
    expect(requirement.block).toBe(
      '### Requirement: A\nText.\n\n#### Scenario: S\n- **THEN** ok',
    )
  })
})
