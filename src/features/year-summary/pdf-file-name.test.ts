import { afterEach, describe, expect, test } from 'vitest'
import { overwriteGetLocale } from '#/paraglide/runtime.js'
import { pdfFileName } from './pdf-file-name'

afterEach(() => {
  overwriteGetLocale(() => 'fi')
})

describe('The PDF file name', () => {
  test('The own share', () => {
    expect(pdfFileName({ kind: 'own' }, 2025)).toBe(
      'kotivalo-vuosiyhteenveto-2025.pdf',
    )
  })

  test("Another owner's name", () => {
    const holder = {
      kind: 'person',
      userId: 'm',
      name: 'Mikko Virtanen',
    } as const
    expect(pdfFileName(holder, 2025)).toBe(
      'kotivalo-vuosiyhteenveto-2025-mikko-virtanen.pdf',
    )
  })

  test('The whole flats', () => {
    expect(pdfFileName({ kind: 'whole' }, 2025)).toBe(
      'kotivalo-vuosiyhteenveto-2025-koko-asunnot.pdf',
    )
  })

  test('The language of the user', () => {
    overwriteGetLocale(() => 'sv')
    expect(pdfFileName({ kind: 'whole' }, 2025)).toBe(
      'kotivalo-arssammandrag-2025-hela-bostaderna.pdf',
    )
    overwriteGetLocale(() => 'en')
    expect(pdfFileName({ kind: 'own' }, 2025)).toBe(
      'kotivalo-year-summary-2025.pdf',
    )
  })

  test('A name with accents and outside the font', () => {
    const holder = {
      kind: 'person',
      userId: 'l',
      name: 'Łukasz Åkesson-Öberg',
    } as const
    expect(pdfFileName(holder, 2025)).toBe(
      'kotivalo-vuosiyhteenveto-2025-lukasz-akesson-oberg.pdf',
    )
  })

  test('A name that leaves no slug', () => {
    const holder = { kind: 'person', userId: 'x', name: '猫 ✓' } as const
    expect(pdfFileName(holder, 2025)).toBe('kotivalo-vuosiyhteenveto-2025.pdf')
  })
})
