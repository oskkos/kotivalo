import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { colors } from '../../../src/theme/tokens.ts'

const css = readFileSync(
  new URL('../src/styles/theme.css', import.meta.url),
  'utf8',
)

/** The `--name: #rrggbb; /* token` declarations, as name, hex and token. */
const declarations = [
  ...css.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6});\s*\/\*\s*(\w+)/gi),
].map((m) => ({ name: m[1], hex: m[2], token: m[3] }))

describe('The guide theme', () => {
  test('every colour is the token its comment names', () => {
    expect(declarations.length).toBeGreaterThan(10)
    for (const { hex, token } of declarations) {
      expect(Object.keys(colors)).toContain(token)
      expect(hex.toLowerCase()).toBe(
        colors[token as keyof typeof colors].toLowerCase(),
      )
    }
  })

  test('no colour is left without a token', () => {
    const hexes = [...css.matchAll(/#[0-9a-f]{6}/gi)].length
    expect(hexes).toBe(declarations.length)
  })
})
