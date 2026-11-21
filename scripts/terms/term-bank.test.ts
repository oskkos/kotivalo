import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  LANGUAGES,
  readSources,
  readTermBank,
  termBankProblems,
  termBankSchema,
  wordPattern,
  type LanguageEntry,
  type Sources,
  type Term,
  type TermBank,
} from './term-bank.ts'

const sources: Sources = {
  vero_sv: {
    name: 'Skatteförvaltningen',
    url: 'https://www.vero.fi/sv/',
    languages: ['sv'],
    authority: 'authoritative',
    useFor: 'tax terms',
  },
  svenska_se: {
    name: 'Svenska.se',
    url: 'https://svenska.se/',
    languages: ['sv'],
    authority: 'reference',
    useFor: 'spelling',
  },
}

const ref = (source: string) => ({
  source,
  url: 'https://www.vero.fi/sv/hyra',
  quote: 'hyresinkomst',
})

function lang(overrides: Partial<LanguageEntry> = {}): LanguageEntry {
  return {
    term: 'hyra',
    match: ['hyr(a|an)'],
    status: 'proposed',
    ...overrides,
  }
}

function bankWithSv(sv: LanguageEntry): TermBank {
  const term: Term = {
    definition: 'Rent',
    fi: { term: 'vuokra', match: ['vuokr(a|an)'], status: 'proposed' },
    sv,
    en: { term: 'rent', match: ['rents?'], status: 'proposed' },
  }
  return { rent: term }
}

describe('Term bank rules', () => {
  test('a proposed term without sources is fine', () => {
    expect(termBankProblems(bankWithSv(lang()), sources)).toEqual([])
  })

  test('a proposed term may not cite sources', () => {
    const problems = termBankProblems(
      bankWithSv(lang({ sources: [ref('vero_sv')] })),
      sources,
    )
    expect(problems).toEqual([
      'rent.sv: a proposed term has no sources; with sources it is derived or verified',
    ])
  })

  test('a derived term needs a source', () => {
    expect(
      termBankProblems(bankWithSv(lang({ status: 'derived' })), sources),
    ).toEqual(['rent.sv: a derived term needs at least one source'])
    expect(
      termBankProblems(
        bankWithSv(lang({ status: 'derived', sources: [ref('svenska_se')] })),
        sources,
      ),
    ).toEqual([])
  })

  test('a verified term needs an authoritative source', () => {
    expect(
      termBankProblems(
        bankWithSv(lang({ status: 'verified', sources: [ref('svenska_se')] })),
        sources,
      ),
    ).toEqual(['rent.sv: a verified term needs an authoritative source'])
    expect(
      termBankProblems(
        bankWithSv(lang({ status: 'verified', sources: [ref('vero_sv')] })),
        sources,
      ),
    ).toEqual([])
  })

  test('a reviewed term records who reviewed it and when', () => {
    expect(
      termBankProblems(bankWithSv(lang({ status: 'reviewed' })), sources),
    ).toEqual([
      'rent.sv: "reviewed" is set exactly when the status is reviewed',
    ])
    expect(
      termBankProblems(
        bankWithSv(
          lang({ reviewed: { by: 'A translator', on: '2026-11-21' } }),
        ),
        sources,
      ),
    ).toEqual([
      'rent.sv: "reviewed" is set exactly when the status is reviewed',
    ])
    expect(
      termBankProblems(
        bankWithSv(
          lang({
            status: 'reviewed',
            reviewed: { by: 'A translator', on: '2026-11-21' },
          }),
        ),
        sources,
      ),
    ).toEqual([])
  })

  test('sources must exist and cover the language', () => {
    const bank = bankWithSv(lang({ status: 'derived', sources: [ref('nope')] }))
    bank.rent.en = {
      term: 'rent',
      match: ['rents?'],
      status: 'derived',
      sources: [ref('svenska_se')],
    }
    expect(termBankProblems(bank, sources)).toEqual([
      'rent.sv: unknown source "nope"',
      'rent.en: source "svenska_se" does not cover en',
    ])
  })

  test('a term matches its own patterns and none of its avoid patterns', () => {
    expect(
      termBankProblems(
        bankWithSv(lang({ match: ['hyror'], avoid: ['hyr\\p{L}*'] })),
        sources,
      ),
    ).toEqual([
      'rent.sv: "hyra" does not match its own patterns',
      'rent.sv: "hyra" matches its own avoid pattern',
    ])
  })

  test('ids are snake_case and patterns compile', () => {
    const result = termBankSchema.safeParse({
      'Bad-Id': bankWithSv(lang()).rent,
      rent: bankWithSv(lang({ match: ['hyr(a'] })).rent,
    })
    expect(result.success).toBe(false)
    const issues = JSON.stringify(result.error?.issues)
    expect(issues).toContain('ids are snake_case')
    expect(issues).toContain('not a valid regular expression')
  })
})

describe('Word patterns', () => {
  test('match whole words in any case, including letters outside ASCII', () => {
    const asunto = wordPattern('asun[nt]o\\p{L}*')
    expect(asunto.test('Asunnot')).toBe(true)
    expect(asunto.test('Lisää asuntosi')).toBe(true)
    expect(asunto.test('vuokra-asunto')).toBe(true)
    expect(asunto.test('omistusasunto')).toBe(false)
    expect(wordPattern('ägare').test('delägare')).toBe(false)
    expect(wordPattern('rents?').test('rented')).toBe(false)
  })
})

describe('The term bank files', () => {
  test('terms.json is valid and follows the rules', () => {
    expect(termBankProblems(readTermBank(), readSources())).toEqual([])
  })

  test('the term bank has exactly the project languages', () => {
    const settings = JSON.parse(
      readFileSync(
        join(import.meta.dirname, '../../project.inlang/settings.json'),
        'utf8',
      ),
    ) as { locales: string[] }
    expect([...LANGUAGES].sort()).toEqual([...settings.locales].sort())
  })
})
