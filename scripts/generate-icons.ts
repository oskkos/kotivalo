// The app icons in public/, drawn from the Kotivalo mark (src/components/
// Logo.tsx; Design canvas, "Main": the plum app icon with a cream roof), and
// the logo at the top of emails (public/email/logo.png): email clients show
// neither SVG nor web fonts, so the mark and the name are one PNG.
// The PNGs are rendered with Playwright's Chromium and committed; run this
// again only when the mark or the colours change.
//
// Usage: pnpm icons:generate
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { colors } from '../src/theme/tokens.ts'

const PUBLIC = join(import.meta.dirname, '..', 'public')

/** The mark (viewBox 0 0 64 64) scaled around the centre. */
function mark(scale: number): string {
  return (
    `<g transform="translate(32 32) scale(${String(scale)}) translate(-32 -32)">` +
    `<circle cx="32" cy="38" r="20" fill="${colors.yellow}"/>` +
    `<path d="M11 31 L32 12 L53 31" fill="none" stroke="${colors.cream}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</g>`
  )
}

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`

// Round, as on the canvas, with transparent corners: browsers and launchers
// that don't mask icons, and the favicon.
const round = svg(
  `<circle cx="32" cy="32" r="32" fill="${colors.plum}"/>${mark(0.63)}`,
)
// Full-bleed: Android masks it to its own shape, and iOS rounds the corners
// (it shows transparency as black). The mark stays inside the maskable safe
// zone, a circle of 80 % of the width.
const square = svg(
  `<rect width="64" height="64" fill="${colors.plum}"/>${mark(0.6)}`,
)

const pngs: { file: string; source: string; size: number }[] = [
  { file: 'icons/icon-192.png', source: round, size: 192 },
  { file: 'icons/icon-512.png', source: round, size: 512 },
  { file: 'icons/icon-maskable-512.png', source: square, size: 512 },
  { file: 'icons/apple-touch-icon.png', source: square, size: 180 },
]

/**
 * The email logo as on the sign-in page: the mark with a plum roof and
 * "kotivalo" in Nunito 900, drawn at twice its size in emails (148 × 32) so
 * it stays sharp on high-density screens.
 */
const EMAIL_LOGO_SCALE = 2
const nunito = readFileSync(
  join(
    import.meta.dirname,
    '..',
    'node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2',
  ),
).toString('base64')
const emailLogo = `<style>
@font-face{font-family:Nunito;font-weight:200 1000;src:url(data:font/woff2;base64,${nunito}) format('woff2')}
html,body{margin:0;background:transparent}
#logo{display:inline-flex;align-items:center;gap:${String(6 * EMAIL_LOGO_SCALE)}px;padding:0 ${String(2 * EMAIL_LOGO_SCALE)}px}
#logo span{font-family:Nunito;font-weight:900;font-size:${String(22 * EMAIL_LOGO_SCALE)}px;letter-spacing:-0.035em;color:${colors.plum};line-height:1}
</style>
<div id="logo"><svg width="${String(32 * EMAIL_LOGO_SCALE)}" height="${String(32 * EMAIL_LOGO_SCALE)}" viewBox="0 0 64 64"><circle cx="32" cy="38" r="20" fill="${colors.yellow}"/><path d="M11 31 L32 12 L53 31" fill="none" stroke="${colors.plum}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>kotivalo</span></div>`

mkdirSync(join(PUBLIC, 'icons'), { recursive: true })
mkdirSync(join(PUBLIC, 'email'), { recursive: true })
writeFileSync(join(PUBLIC, 'favicon.svg'), `${round}\n`)

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  for (const { file, source, size } of pngs) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${String(size)}px;height:${String(size)}px}</style>${source}`,
    )
    await page.screenshot({ path: join(PUBLIC, file), omitBackground: true })
    console.log(`public/${file}`)
  }
  await page.setViewportSize({ width: 600, height: 200 })
  await page.setContent(emailLogo)
  await page.evaluate(() => document.fonts.ready)
  await page
    .locator('#logo')
    .screenshot({ path: join(PUBLIC, 'email/logo.png'), omitBackground: true })
  const size = await page.locator('#logo').boundingBox()
  console.log(
    `public/email/logo.png (${String(size?.width)} × ${String(size?.height)})`,
  )
} finally {
  await browser.close()
}
