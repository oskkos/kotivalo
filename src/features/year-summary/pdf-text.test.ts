import { describe, expect, test } from 'vitest'

import { pdfText } from './pdf-text'

describe("Text the PDF font can't show", () => {
  test('Names outside the font', () => {
    expect(pdfText('Łukasz Wiśniewski')).toBe('Lukasz Wisniewski')
  })

  test('Finnish and Swedish letters are kept', () => {
    const text = 'Åkerögatan 4 Ä, 1 234,56 € · § – ä ö å Ä Ö Å'
    expect(pdfText(text)).toBe(text)
  })

  test('The arrow becomes a dash', () => {
    expect(pdfText('50 % → 100 %')).toBe('50 % – 100 %')
  })

  test('Anything else becomes a question mark', () => {
    expect(pdfText('猫 ✓')).toBe('? ?')
  })
})
