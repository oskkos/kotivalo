import { getContrastRatio } from '@mui/material/styles'
import { describe, expect, test } from 'vitest'
import { colors } from './tokens'
import { TOUCH_TARGET, themeFor } from './theme'

// Text and the surfaces it sits on in the design canvas. WCAG 2.2 AA asks
// for 4.5:1 for normal-size text.
const textPairs: [string, string, string][] = [
  ['text on cream', colors.plum, colors.cream],
  ['text on white', colors.plum, colors.white],
  ['text on yellow (accent buttons)', colors.plum, colors.yellow],
  ['text on yellow tint (chips)', colors.plum, colors.yellowTint],
  ['text on lavender tint', colors.plum, colors.lavenderTint],
  ['text on green tint (chips)', colors.plum, colors.greenTint],
  ['text on lavender', colors.plum, colors.lavender],
  ['text on sand (segmented control)', colors.plum, colors.sand],
  ['secondary text on cream', colors.plumMuted, colors.cream],
  ['secondary text on white', colors.plumMuted, colors.white],
  ['secondary text on yellow tint', colors.plumMuted, colors.yellowTint],
  ['secondary text on lavender tint', colors.plumMuted, colors.lavenderTint],
  ['inactive navigation on white', colors.plumSubtle, colors.white],
  ['placeholder on white', colors.placeholder, colors.white],
  ['placeholder on cream', colors.placeholder, colors.cream],
  ['cream on plum', colors.cream, colors.plum],
  ['muted text on plum', colors.onPlumMuted, colors.plum],
  ['yellow on plum', colors.yellow, colors.plum],
  ['error text on cream', colors.error, colors.cream],
  ['error text on white', colors.error, colors.white],
  ['text on the error alert', colors.plum, colors.errorSurface],
  ['white on error', colors.white, colors.error],
]

describe('Theme colors', () => {
  test.each(textPairs)('%s is at least 4.5:1', (_name, text, surface) => {
    expect(getContrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5)
  })

  test('the palette uses the brand colors', () => {
    const { palette } = themeFor('fi')
    expect(palette.primary.main).toBe(colors.plum)
    expect(palette.accent.main).toBe(colors.yellow)
    expect(palette.background.default).toBe(colors.cream)
    expect(palette.secondary.main).toBe(colors.lavender)
    expect(palette.error.main).toBe(colors.error)
  })
})

describe('Theme touch targets', () => {
  test('buttons and icon buttons are at least 44 px high', () => {
    const { components } = themeFor('fi')
    expect(components?.MuiButton?.styleOverrides?.root).toMatchObject({
      minHeight: TOUCH_TARGET,
    })
    expect(components?.MuiIconButton?.styleOverrides?.root).toMatchObject({
      minHeight: TOUCH_TARGET,
      minWidth: TOUCH_TARGET,
    })
    expect(TOUCH_TARGET).toBeGreaterThanOrEqual(44)
  })
})

describe('Theme localisation', () => {
  test.each([
    ['fi', 'Sulje'],
    ['sv', 'Stäng'],
    ['en', 'Close'],
  ] as const)('MUI component text is in %s', (locale, close) => {
    // enUS sets nothing: MUI's built-in text is English.
    const closeText =
      themeFor(locale).components?.MuiAlert?.defaultProps?.closeText ?? 'Close'
    expect(closeText).toBe(close)
  })

  test('the localised themes keep the Kotivalo styles', () => {
    expect(themeFor('sv').palette.primary.main).toBe(colors.plum)
    expect(themeFor('en').typography.fontFamily).toBe(
      themeFor('fi').typography.fontFamily,
    )
  })
})
