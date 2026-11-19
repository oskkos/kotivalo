import { describe, expect, test } from 'vitest'
import { offlinePage } from './offline-page.server'

describe('offlinePage', () => {
  const html = offlinePage()

  test('carries the text in every language', () => {
    expect(html).toContain('Ei verkkoyhteyttä')
    expect(html).toContain('Ingen nätverksanslutning')
    expect(html).toContain('No connection')
  })

  test('shows Finnish until the script picks a language', () => {
    expect(html).toContain('<section lang="fi" data-locale="fi">')
    expect(html).toContain('<section lang="sv" data-locale="sv" hidden>')
    expect(html).toContain('<section lang="en" data-locale="en" hidden>')
  })

  test('picks the language from the language cookie', () => {
    expect(html).toContain('"kotivalo_locale="')
  })

  test('loads nothing from elsewhere', () => {
    expect(html).not.toMatch(/<(link|img)\b|\bsrc=/)
  })
})
