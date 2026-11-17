// Paraglide compiles a message that is missing in one language into the
// Finnish one, silently. These checks make every language complete.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { baseLocale, locales } from '#/paraglide/runtime.js'

const MESSAGES = join(import.meta.dirname, '../messages')

type Messages = Record<string, unknown>

function readMessages(locale: string): Messages {
  const json = readFileSync(join(MESSAGES, `${locale}.json`), 'utf8')
  const messages = JSON.parse(json) as Messages
  delete messages.$schema
  return messages
}

/** Every text in a message: a plain string, or the strings inside variants. */
function texts(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }
  if (Array.isArray(value)) {
    return value.flatMap(texts)
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(texts)
  }
  return []
}

/** The {variables} a message uses, sorted. */
function variables(value: unknown): string[] {
  const names = texts(value).flatMap((text) =>
    [...text.matchAll(/\{\s*([A-Za-z_]\w*)\s*\}/g)].map((match) => match[1]),
  )
  return [...new Set(names)].sort()
}

const base = readMessages(baseLocale)
const others = locales.filter((locale) => locale !== baseLocale)

describe('Messages', () => {
  test.each(others)('%s has the same keys as Finnish', (locale) => {
    expect(Object.keys(readMessages(locale)).sort()).toEqual(
      Object.keys(base).sort(),
    )
  })

  test.each(others)(
    '%s uses the same variables as Finnish in each message',
    (locale) => {
      const messages = readMessages(locale)
      const differing = Object.keys(base).filter(
        (key) =>
          key in messages &&
          variables(messages[key]).join() !== variables(base[key]).join(),
      )
      expect(differing).toEqual([])
    },
  )

  test.each(locales)('%s has no empty messages', (locale) => {
    const messages = readMessages(locale)
    const empty = Object.keys(messages).filter((key) =>
      texts(messages[key]).every((text) => text.trim() === ''),
    )
    expect(empty).toEqual([])
  })
})
