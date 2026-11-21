import { describe, expect, test } from 'vitest'
import { readTermBank, type LanguageEntry, type TermBank } from './term-bank.ts'
import {
  messageText,
  readAllMessages,
  termsIn,
  usageProblems,
  type MessagesByLanguage,
} from './usage.ts'

const entry = (
  term: string,
  match: string[],
  extra: Partial<LanguageEntry> = {},
): LanguageEntry => ({ term, match, status: 'proposed', ...extra })

const bank: TermBank = {
  access: {
    definition: 'Access',
    fi: entry('pääsy', ['pääsy\\p{L}*']),
    sv: entry('åtkomst', ['åtkomst\\p{L}*'], { avoid: ['tillgång\\p{L}*'] }),
    en: entry('access', ['access']),
  },
  ownership: {
    definition: 'Ownership',
    fi: entry('omistus', ['omistu(s|ks)\\p{L}*']),
    sv: entry('ägande', ['ägande\\p{L}*']),
    en: entry('ownership', ['ownership']),
  },
  ownership_period: {
    definition: 'Ownership period',
    fi: entry('omistusjakso', ['omistusjaks\\p{L}*']),
    sv: entry('ägarperiod', ['ägarperiod\\p{L}*']),
    en: entry('ownership period', ['ownership periods?']),
  },
}

function messages(
  fi: string,
  sv: string,
  en: string,
  key = 'some_message',
): MessagesByLanguage {
  return { fi: { [key]: fi }, sv: { [key]: sv }, en: { [key]: en } }
}

describe('Message text', () => {
  test('leaves out variables and reads every variant', () => {
    expect(messageText('Poista {name} asunnosta')).toBe('Poista   asunnosta')
    const plural = [
      {
        declarations: ['input count', 'local countPlural = count: plural'],
        selectors: ['countPlural'],
        match: {
          'countPlural=one': '{count} asunto',
          'countPlural=other': '{count} asuntoa',
        },
      },
    ]
    expect(messageText(plural)).toBe('  asunto\n  asuntoa')
  })
})

describe('Terms in a text', () => {
  test('finds inflected terms', () => {
    expect(termsIn(bank, 'fi', 'Muut, joilla on pääsy')).toEqual(
      new Set(['access']),
    )
    expect(termsIn(bank, 'fi', 'Omistuksen alkupäivä')).toEqual(
      new Set(['ownership']),
    )
  })

  test('the longer of two overlapping terms wins', () => {
    expect(termsIn(bank, 'fi', 'Ensimmäinen omistusjakso')).toEqual(
      new Set(['ownership_period']),
    )
  })
})

describe('Messages follow the term bank', () => {
  test('passes when every language uses the term', () => {
    expect(
      usageProblems(
        bank,
        messages(
          'Muut, joilla on pääsy',
          'Andra med åtkomst',
          'Others with access',
        ),
      ),
    ).toEqual([])
  })

  test("reports a translation that doesn't use the term", () => {
    expect(
      usageProblems(
        bank,
        messages('Muut, joilla on pääsy', 'Andra med åtkomst', 'Other people'),
      ),
    ).toEqual([
      'some_message (en): the Finnish uses "pääsy" but the en text does not use "access" (term access)',
    ])
  })

  test('reports an avoided alternative', () => {
    expect(
      usageProblems(
        bank,
        messages(
          'Muut, joilla on pääsy',
          'Andra med åtkomst och tillgång',
          'Others with access',
        ),
      ),
    ).toEqual([
      'some_message (sv): "tillgång" is avoided; use "åtkomst" (term access)',
    ])
  })

  test('an exception lets a message leave the term out', () => {
    const withException: TermBank = {
      ...bank,
      access: {
        ...bank.access,
        en: { ...bank.access.en, except: { some_message: 'Shorter' } },
      },
    }
    expect(
      usageProblems(
        withException,
        messages('Muut, joilla on pääsy', 'Andra med åtkomst', 'Others'),
      ),
    ).toEqual([])
  })

  test('reports exceptions that are no longer needed', () => {
    const withExceptions: TermBank = {
      ...bank,
      access: {
        ...bank.access,
        en: {
          ...bank.access.en,
          except: { some_message: 'Shorter', gone_message: 'Removed' },
        },
      },
    }
    expect(
      usageProblems(
        withExceptions,
        messages(
          'Muut, joilla on pääsy',
          'Andra med åtkomst',
          'Others with access',
        ),
      ),
    ).toEqual([
      'access.en: exception for some_message is not needed; remove it',
      'access.en: exception for unknown message gone_message',
    ])
  })

  test('the app messages use the term bank', () => {
    expect(usageProblems(readTermBank(), readAllMessages())).toEqual([])
  })
})
