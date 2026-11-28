import { afterEach, describe, expect, test } from 'vitest'
import { overwriteGetLocale, type Locale } from '#/paraglide/runtime.js'
import { labelWithOriginal, originalText, withOriginal } from './original-text'
import { outsideTitleOriginal, partOriginal, rowOriginal } from './row-text'
import { ROW_NUMBERS } from './summary'

const inLocale = (locale: Locale) => {
  overwriteGetLocale(() => locale)
}

afterEach(() => {
  inLocale('fi')
})

describe('originalText', () => {
  test('lowers the first letter', () => {
    expect(originalText('Hoitovastikkeet ja vesimaksut')).toBe(
      'hoitovastikkeet ja vesimaksut',
    )
  })

  test('turns an inner bracket into a comma', () => {
    expect(originalText('Rahoitusvastikkeet (rahastoitu)')).toBe(
      'rahoitusvastikkeet, rahastoitu',
    )
  })
})

describe('withOriginal', () => {
  test('has no original in Finnish', () => {
    inLocale('fi')
    expect(withOriginal('Hoitovastike', () => 'Hoitovastike')).toEqual({
      text: 'Hoitovastike',
      original: null,
    })
  })

  test('puts the original in brackets for one string', () => {
    const item = withOriginal('Maintenance charge', () => 'Hoitovastike', 'en')
    expect(labelWithOriginal(item)).toBe('Maintenance charge (hoitovastike)')
    expect(labelWithOriginal({ text: 'Hoitovastike', original: null })).toBe(
      'Hoitovastike',
    )
  })
})

describe('the originals of the labels', () => {
  test.each([
    ['sv', '2.1', 'Bruttohyresinkomster (bruttovuokratulot)'],
    [
      'sv',
      '2.2',
      'Skötselvederlag och vattenavgifter (hoitovastikkeet ja vesimaksut)',
    ],
    [
      'sv',
      '2.3',
      'Kapitalvederlag som bolaget intäktsfört (yhtiön tulouttamat pääomavastikkeet)',
    ],
    ['sv', '2.4', 'Kostnader för årliga reparationer (vuosikorjauskulut)'],
    ['sv', '2.5', 'Övriga kostnader (muut kulut)'],
    ['en', '2.1', 'Gross rental income (bruttovuokratulot)'],
    ['fi', '2.2', 'Hoitovastikkeet ja vesimaksut'],
  ] as const)('%s: row %s', (locale, row, expected) => {
    inLocale(locale)
    expect(labelWithOriginal(rowOriginal(row))).toBe(expected)
  })

  test('every row has an original in Swedish and English, none in Finnish', () => {
    for (const row of ROW_NUMBERS) {
      inLocale('fi')
      expect(rowOriginal(row).original).toBeNull()
      for (const locale of ['sv', 'en'] as const) {
        inLocale(locale)
        expect(rowOriginal(row).original).toMatch(/^\p{Ll}/u)
      }
    }
  })

  test('the parts that are tax terms', () => {
    inLocale('sv')
    expect(labelWithOriginal(partOriginal('maintenance_charge'))).toBe(
      'Skötselvederlag (hoitovastike)',
    )
    expect(partOriginal('financing_charge').original).toBe('rahoitusvastike')
    expect(partOriginal('annual_repair').original).toBe('vuosikorjaus')
  })

  test('other parts and usage charges get no original', () => {
    inLocale('sv')
    expect(partOriginal('water').original).toBeNull()
    expect(partOriginal('rent_payments').original).toBeNull()
  })

  test('a title with a bracket', () => {
    inLocale('en')
    expect(labelWithOriginal(outsideTitleOriginal.capitalised())).toMatch(
      /^Financing charges \(.+\) \(rahoitusvastikkeet, rahastoitu\)$/,
    )
  })

  test('the identity code label', () => {
    inLocale('sv')
    expect(outsideTitleOriginal.identity_code().original).toBe(
      'vuokralaisen henkilötunnus',
    )
  })
})
