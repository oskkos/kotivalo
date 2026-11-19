import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { colors } from './theme/tokens'

interface Manifest {
  start_url: string
  display: string
  theme_color: string
  background_color: string
  icons: { src: string; sizes: string; type: string; purpose: string }[]
}

const publicFile = (path: string) =>
  readFileSync(new URL(`../public${path}`, import.meta.url))

const manifest = JSON.parse(
  publicFile('/manifest.webmanifest').toString('utf8'),
) as Manifest

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Buffer): string {
  return `${String(bytes.readUInt32BE(16))}x${String(bytes.readUInt32BE(20))}`
}

describe('Web app manifest', () => {
  test('opens the app full screen at the home page', () => {
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
  })

  test('uses the theme colours: cream bars and a plum splash', () => {
    expect(manifest.theme_color).toBe(colors.cream)
    expect(manifest.background_color).toBe(colors.plum)
  })

  test('has 192 and 512 px icons and a maskable one', () => {
    expect(
      manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`),
    ).toEqual(['192x192 any', '512x512 any', '512x512 maskable'])
  })

  test('lists icons that exist in their stated size', () => {
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png')
      expect(pngSize(publicFile(icon.src))).toBe(icon.sizes)
    }
    expect(pngSize(publicFile('/icons/apple-touch-icon.png'))).toBe('180x180')
  })
})
