import { defineConfig } from '@inlang/paraglide-js'

// Read by both the Vite plugin (dev, build, Vitest) and `paraglide-js compile`
// (pnpm i18n:compile, run on install), so the generated runtime is the same.
export default defineConfig({
  outdir: './src/paraglide',
  // Real files on disk in every tool, so tsc, ESLint and Vite see the same
  // output. (The Vite plugin would otherwise use virtual modules.)
  outputStructure: 'message-modules',
  emitTsDeclarations: true,
  // Before sign-in: the language chosen earlier (cookie), then the browser
  // language, then Finnish. Signed-in users get theirs from the user record,
  // added with auth (#13) as a custom server strategy in front of these.
  strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
  cookieName: 'kotivalo_locale',
  cookieSameSite: 'lax',
  cookieSecure: 'auto',
})
