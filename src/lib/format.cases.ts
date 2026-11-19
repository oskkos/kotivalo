// Expected output of the format helpers, shared by the Node (format.test.ts)
// and Workers (format.server.test.ts) tests: Intl data comes from each
// runtime's ICU, so both are checked.
import type { Locale } from '#/paraglide/runtime.js'

// Intl separates digit groups and the euro sign with no-break spaces, and
// writes negative amounts with a minus sign (U+2212).
const nbsp = ' '
const minus = '−'

export const moneyCases: [Locale, number, string][] = [
  ['fi', 123456, `1${nbsp}234,56${nbsp}€`],
  ['sv', 123456, `1${nbsp}234,56${nbsp}€`],
  ['en', 123456, '€1,234.56'],
  ['fi', -5, `${minus}0,05${nbsp}€`],
  ['fi', 0, `0,00${nbsp}€`],
]

export const dateCases: [Locale, string, string][] = [
  ['fi', '2026-03-05', '5.3.2026'],
  ['sv', '2026-03-05', '5.3.2026'],
  ['en', '2026-03-05', '05/03/2026'],
  ['fi', '2026-12-31', '31.12.2026'],
]

export const areaCases: [Locale, number, string][] = [
  ['fi', 485, `48,5${nbsp}m²`],
  ['sv', 485, `48,5${nbsp}m²`],
  ['en', 485, `48.5${nbsp}m²`],
  ['fi', 490, `49${nbsp}m²`],
  ['fi', 12005, `1200,5${nbsp}m²`],
]
