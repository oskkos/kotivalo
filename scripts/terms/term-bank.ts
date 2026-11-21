// The term bank (i18n/terms.json) and its reference sources
// (i18n/sources.json): one terminology for Finnish, Swedish and English.
// This module reads and validates them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

export const LANGUAGES = ['fi', 'sv', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

/**
 * How sure we are of a term, from what was found, not from a feeling:
 * - `proposed`: a suggestion with no source behind it yet
 * - `derived`: built from sources, e.g. a compound of two verified parts
 * - `verified`: an authoritative source uses it in this meaning
 * - `reviewed`: a person fluent in the language accepted it
 */
export const STATUSES = ['proposed', 'derived', 'verified', 'reviewed'] as const
export type Status = (typeof STATUSES)[number]

const isoDate = z.iso.date()

/** A regular expression source, compiled with the `iu` flags. */
const pattern = z.string().refine(
  (source) => {
    try {
      new RegExp(source, 'iu')
      return true
    } catch {
      return false
    }
  },
  { error: 'not a valid regular expression' },
)

const sourceRef = z.strictObject({
  /** An id from i18n/sources.json. */
  source: z.string(),
  url: z.url(),
  /** A short quote showing the term in use, so it can be checked. */
  quote: z.string().min(1).max(300),
})

const languageEntry = z.strictObject({
  /** The preferred word, as written in a sentence (lower case unless a name). */
  term: z.string().min(1),
  /** Patterns that recognise the term in messages, in all its inflections. */
  match: z.array(pattern).min(1),
  /** Alternatives decided against; no message may use them. */
  avoid: z.array(pattern).optional(),
  /** Messages that may leave the term out, with the reason: key → reason. */
  except: z.record(z.string(), z.string().min(1)).optional(),
  status: z.enum(STATUSES),
  sources: z.array(sourceRef).optional(),
  reviewed: z.strictObject({ by: z.string().min(1), on: isoDate }).optional(),
})
export type LanguageEntry = z.infer<typeof languageEntry>

const term = z.strictObject({
  /** The name in code, the database and tests, if the term has one. */
  code: z.string().optional(),
  /** Notes for code: tables, columns, units. */
  codeNotes: z.string().optional(),
  definition: z.string().min(1),
  notes: z.string().optional(),
  /** A tax term: Swedish and English text also shows the Finnish original. */
  showOriginal: z.boolean().optional(),
  fi: languageEntry,
  sv: languageEntry,
  en: languageEntry,
})
export type Term = z.infer<typeof term>

const termId = z
  .string()
  .regex(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, { error: 'ids are snake_case' })

export const termBankSchema = z.record(termId, term)
export type TermBank = z.infer<typeof termBankSchema>

const source = z.strictObject({
  name: z.string().min(1),
  url: z.url(),
  languages: z.array(z.enum(LANGUAGES)).min(1),
  /**
   * `authoritative`: an official source for the term (the Tax
   * Administration, the law in that language). `reference`: a dictionary or
   * term bank that supports a choice but does not settle it.
   */
  authority: z.enum(['authoritative', 'reference']),
  /** What the source is good for. */
  useFor: z.string().min(1),
})
export type Source = z.infer<typeof source>

export const sourcesSchema = z.record(termId, source)
export type Sources = z.infer<typeof sourcesSchema>

/** A pattern as it is matched: whole words only, case-insensitive. */
export function wordPattern(source: string, flags = 'iu'): RegExp {
  return new RegExp(`(?<!\\p{L})(?:${source})(?!\\p{L})`, flags)
}

/**
 * Rules the schema can't express: statuses backed by the right sources,
 * known source ids, terms that match their own patterns. Returns one line
 * per problem.
 */
export function termBankProblems(bank: TermBank, sources: Sources): string[] {
  const problems: string[] = []
  for (const [id, entry] of Object.entries(bank)) {
    for (const language of LANGUAGES) {
      const at = `${id}.${language}`
      const lang = entry[language]
      const refs = lang.sources ?? []
      for (const ref of refs) {
        if (!(ref.source in sources)) {
          problems.push(`${at}: unknown source "${ref.source}"`)
        } else if (!sources[ref.source].languages.includes(language)) {
          problems.push(
            `${at}: source "${ref.source}" does not cover ${language}`,
          )
        }
      }
      if (lang.status === 'proposed' && refs.length > 0) {
        problems.push(
          `${at}: a proposed term has no sources; with sources it is derived or verified`,
        )
      }
      if (lang.status === 'derived' && refs.length === 0) {
        problems.push(`${at}: a derived term needs at least one source`)
      }
      if (
        lang.status === 'verified' &&
        !refs.some(
          (ref) =>
            ref.source in sources &&
            sources[ref.source].authority === 'authoritative',
        )
      ) {
        problems.push(`${at}: a verified term needs an authoritative source`)
      }
      if ((lang.status === 'reviewed') !== (lang.reviewed !== undefined)) {
        problems.push(
          `${at}: "reviewed" is set exactly when the status is reviewed`,
        )
      }
      if (!lang.match.some((source) => wholeMatch(source, lang.term))) {
        problems.push(`${at}: "${lang.term}" does not match its own patterns`)
      }
      for (const avoid of lang.avoid ?? []) {
        if (wordPattern(avoid).test(lang.term)) {
          problems.push(`${at}: "${lang.term}" matches its own avoid pattern`)
        }
      }
    }
  }
  return problems
}

function wholeMatch(source: string, text: string): boolean {
  return new RegExp(`^(?:${source})$`, 'iu').test(text)
}

const I18N = join(import.meta.dirname, '../../i18n')

export function readTermBank(): TermBank {
  return termBankSchema.parse(readJson('terms.json'))
}

export function readSources(): Sources {
  return sourcesSchema.parse(readJson('sources.json'))
}

function readJson(name: string): unknown {
  const json = JSON.parse(readFileSync(join(I18N, name), 'utf8')) as Record<
    string,
    unknown
  >
  delete json.$schema
  return json
}
