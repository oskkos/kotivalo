import { describe, expect, test } from 'vitest'
import fi from '../../../messages/fi.json' with { type: 'json' }
import { uiText } from './ui-text.ts'

describe('UI names in the guide come from the messages', () => {
  test('A button name in Finnish', () => {
    expect(uiText(fi, 'account_title')).toBe('Tili')
  })

  test('An unknown key', () => {
    expect(() => uiText(fi, 'account_titel')).toThrow('"account_titel"')
  })

  test('A message with a variable', () => {
    expect(() => uiText(fi, 'year_summary_empty_title')).toThrow(
      /"year_summary_empty_title".*\{year\}/,
    )
  })

  test('A message with plural forms', () => {
    expect(() => uiText(fi, 'amounts_effect_acquisition_down')).toThrow(
      'plural',
    )
  })
})
