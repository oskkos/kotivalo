// The page the service worker (public/sw.js) shows when a page can't be
// loaded without a connection. The service worker keeps one copy, so the
// page carries every language and picks one in the browser, the way the
// app does before sign-in: the language cookie, then the browser language,
// then Finnish. It has no data and loads nothing else.
import { m } from '#/paraglide/messages.js'
import {
  baseLocale,
  cookieName,
  locales,
  type Locale,
} from '#/paraglide/runtime.js'
import { escapeHtml } from '#/server/email/layout'
import { colors, fontFamily, radii } from '#/theme/tokens'

export const OFFLINE_PATH = '/offline'

function section(locale: Locale): string {
  const text = (value: string) => escapeHtml(value)
  return (
    `<section lang="${locale}" data-locale="${locale}"${locale === baseLocale ? '' : ' hidden'}>` +
    `<h1>${text(m.offline_title({}, { locale }))}</h1>` +
    `<p>${text(m.offline_body({}, { locale }))}</p>` +
    `<button type="button">${text(m.offline_retry({}, { locale }))}</button>` +
    `</section>`
  )
}

// Shows the section for the chosen language; every button reloads.
const script = `(() => {
  const locales = ${JSON.stringify(locales)}
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(${JSON.stringify(`${cookieName}=`)}))
    ?.split('=')[1]
  const preferred = navigator.languages.map((tag) => tag.split('-')[0])
  const locale =
    [cookie, ...preferred].find((tag) => locales.includes(tag)) ??
    ${JSON.stringify(baseLocale)}
  document.documentElement.lang = locale
  for (const section of document.querySelectorAll('[data-locale]')) {
    section.hidden = section.dataset.locale !== locale
  }
  for (const button of document.querySelectorAll('button')) {
    button.addEventListener('click', () => location.reload())
  }
})()`

const style = `
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:${colors.cream};color:${colors.plum};font-family:${fontFamily};font-weight:700}
main{max-width:340px;padding:24px;text-align:center}
h1{margin:16px 0 8px;font-size:26px;font-weight:900}
p{margin:0 0 24px;font-size:16px;line-height:1.5;color:${colors.plumMuted}}
button{min-height:48px;padding:0 28px;border:0;border-radius:${String(radii.pill)}px;background:${colors.plum};color:${colors.cream};font:inherit;font-weight:800;font-size:16px;cursor:pointer}
[hidden]{display:none}`

export function offlinePage(): string {
  return (
    `<!doctype html><html lang="${baseLocale}"><head>` +
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` +
    `<meta name="theme-color" content="${colors.cream}">` +
    `<title>Kotivalo</title>` +
    `<style>${style}</style>` +
    `</head><body><main>` +
    `<svg width="72" height="72" viewBox="0 0 64 64" aria-hidden="true">` +
    `<circle cx="32" cy="38" r="20" fill="${colors.yellow}"/>` +
    `<path d="M11 31 L32 12 L53 31" fill="none" stroke="${colors.plum}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>` +
    locales.map(section).join('') +
    `</main><script>${script}</script></body></html>`
  )
}
