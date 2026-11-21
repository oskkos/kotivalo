// Checks messages against the term bank: when a Finnish message uses a term,
// the Swedish and English messages use that term's translation, and no
// message uses an alternative the bank decided against.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  LANGUAGES,
  wordPattern,
  type Language,
  type TermBank,
} from './term-bank.ts'

export type Messages = Record<string, unknown>
export type MessagesByLanguage = Record<Language, Messages>

const MESSAGES = join(import.meta.dirname, '../../messages')

export function readAllMessages(): MessagesByLanguage {
  const read = (language: Language): Messages => {
    const messages = JSON.parse(
      readFileSync(join(MESSAGES, `${language}.json`), 'utf8'),
    ) as Messages
    delete messages.$schema
    return messages
  }
  return { fi: read('fi'), sv: read('sv'), en: read('en') }
}

/** A message's text: all its variants, without {variables}. */
export function messageText(value: unknown): string {
  return texts(value)
    .map((text) => text.replace(/\{[^}]*\}/g, ' '))
    .join('\n')
}

function texts(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }
  if (Array.isArray(value)) {
    return value.flatMap(texts)
  }
  if (typeof value === 'object' && value !== null) {
    // Variant messages: only the texts in "match", not the declarations.
    const object = value as Record<string, unknown>
    if ('match' in object && 'declarations' in object) {
      return texts(object.match)
    }
    return Object.values(object).flatMap(texts)
  }
  return []
}

interface Hit {
  id: string
  start: number
  end: number
}

/**
 * The terms a text uses. Where two terms match overlapping words, the longer
 * match wins, and on a tie the term with the longer word: "omistusjakso" is
 * an ownership period, not ownership.
 */
export function termsIn(
  bank: TermBank,
  language: Language,
  text: string,
): Set<string> {
  const hits: Hit[] = []
  for (const [id, term] of Object.entries(bank)) {
    for (const source of term[language].match) {
      for (const match of text.matchAll(wordPattern(source, 'giu'))) {
        hits.push({
          id,
          start: match.index,
          end: match.index + match[0].length,
        })
      }
    }
  }
  const weight = (hit: Hit) =>
    [hit.end - hit.start, bank[hit.id][language].term.length] as const
  const beats = (a: Hit, b: Hit) => {
    const [aLength, aWord] = weight(a)
    const [bLength, bWord] = weight(b)
    return aLength !== bLength ? aLength > bLength : aWord > bWord
  }
  const kept = hits.filter(
    (hit) =>
      !hits.some(
        (other) =>
          other.id !== hit.id &&
          other.start < hit.end &&
          hit.start < other.end &&
          beats(other, hit),
      ),
  )
  return new Set(kept.map((hit) => hit.id))
}

function uses(patterns: string[], text: string): boolean {
  return patterns.some((source) => wordPattern(source).test(text))
}

/** One line per message that drifts from the term bank. */
export function usageProblems(
  bank: TermBank,
  messages: MessagesByLanguage,
): string[] {
  const problems: string[] = []
  const translations = LANGUAGES.filter((language) => language !== 'fi')
  const needed = new Set<string>()

  for (const key of Object.keys(messages.fi)) {
    const fiText = messageText(messages.fi[key])
    for (const id of termsIn(bank, 'fi', fiText)) {
      for (const language of translations) {
        const entry = bank[id][language]
        if (!(key in messages[language])) {
          continue
        }
        const text = messageText(messages[language][key])
        if (uses(entry.match, text)) {
          continue
        }
        if (entry.except && key in entry.except) {
          needed.add(`${id}.${language}.${key}`)
          continue
        }
        problems.push(
          `${key} (${language}): the Finnish uses "${bank[id].fi.term}" but the ${language} text does not use "${entry.term}" (term ${id})`,
        )
      }
    }
  }

  for (const [id, term] of Object.entries(bank)) {
    for (const language of LANGUAGES) {
      const entry = term[language]
      for (const key of Object.keys(entry.except ?? {})) {
        if (!(key in messages.fi)) {
          problems.push(
            `${id}.${language}: exception for unknown message ${key}`,
          )
        } else if (!needed.has(`${id}.${language}.${key}`)) {
          problems.push(
            `${id}.${language}: exception for ${key} is not needed; remove it`,
          )
        }
      }
      for (const source of entry.avoid ?? []) {
        const avoid = wordPattern(source, 'giu')
        for (const [key, value] of Object.entries(messages[language])) {
          for (const match of messageText(value).matchAll(avoid)) {
            problems.push(
              `${key} (${language}): "${match[0]}" is avoided; use "${entry.term}" (term ${id})`,
            )
          }
        }
      }
    }
  }
  return problems
}
