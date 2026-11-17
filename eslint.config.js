// @ts-check
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import eslintReact from '@eslint-react/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import pluginRouter from '@tanstack/eslint-plugin-router'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import vitest from '@vitest/eslint-plugin'
import playwright from 'eslint-plugin-playwright'

// Brand name and other strings that are never translated.
const UNTRANSLATED = ['kotivalo', 'Kotivalo']
const untranslatedRe = `/^\\s*(${UNTRANSLATED.join('|')})?\\s*$/`

// "No hard-coded text" (CLAUDE.md, i18n): all UI copy comes from Paraglide
// messages. eslint-plugin-react's jsx-no-literals does not support ESLint 10,
// so the rule is expressed with selectors.
const noHardCodedText = [
  {
    selector: `JSXText:not([value=${untranslatedRe}])`,
    message: 'No hard-coded UI text: use a Paraglide message (m.key()).',
  },
  {
    selector: `JSXExpressionContainer > Literal[raw=/^['"]/]:not([value=${untranslatedRe}])`,
    message: 'No hard-coded UI text: use a Paraglide message (m.key()).',
  },
  {
    selector: 'JSXExpressionContainer > TemplateLiteral[expressions.length=0]',
    message: 'No hard-coded UI text: use a Paraglide message (m.key()).',
  },
  {
    selector: `JSXAttribute[name.name=/^(aria-label|aria-description|title|alt|placeholder|label|helperText)$/] > Literal:not([value=${untranslatedRe}])`,
    message:
      'No hard-coded text in user-facing attributes: use a Paraglide message (m.key()).',
  },
]

// Boundaries (CLAUDE.md, "Cloudflare stays inside src/server/platform/" and
// "Repositories"). Each pattern group is allowed only in the listed files.
const cloudflareOnlyInPlatform = {
  group: ['cloudflare:*'],
  message:
    'Cloudflare APIs and bindings are allowed only in src/server/platform/. Use the per-request context.',
}
const drizzleOnlyInRepositories = {
  group: ['drizzle-orm', 'drizzle-orm/*'],
  message:
    'Drizzle is allowed only in *.repository.server.ts, src/server/db/ (schema) and src/server/platform/. Use a repository.',
}
// Tests may use cloudflare:test (SELF, helpers) and the env from
// cloudflare:workers to reach bindings directly.
const cloudflareOnlyInPlatformExceptTests = {
  ...cloudflareOnlyInPlatform,
  group: ['cloudflare:*', '!cloudflare:test', '!cloudflare:workers'],
}
const PLATFORM = ['src/server/platform/**']
const TESTS = ['src/**/*.test.{ts,tsx}', 'src/test/**', 'scripts/**/*.test.ts']
const DRIZZLE_ALLOWED = [
  ...PLATFORM,
  'src/server/db/**',
  'src/**/*.repository.server.ts',
]

export default defineConfig([
  globalIgnores([
    'dist/',
    'test-results/',
    'playwright-report/',
    'blob-report/',
    '.*/', // dot directories: .wrangler, .tanstack, editor and tool state
    'src/routeTree.gen.ts',
    'worker-configuration.d.ts',
  ]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      eslintReact.configs['recommended-type-checked'],
      reactHooks.configs.flat['recommended-latest'],
      pluginRouter.configs['flat/recommended'],
    ],
    languageOptions: { globals: globals.browser },
  },

  {
    files: ['src/**/*.tsx'],
    ignores: TESTS,
    rules: { 'no-restricted-syntax': ['error', ...noHardCodedText] },
  },

  // Import boundaries: one block per allowed area, because a later
  // no-restricted-imports entry replaces an earlier one for the same file.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: DRIZZLE_ALLOWED,
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [cloudflareOnlyInPlatform, drizzleOnlyInRepositories] },
      ],
    },
  },
  {
    files: DRIZZLE_ALLOWED,
    ignores: PLATFORM,
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [cloudflareOnlyInPlatform] },
      ],
    },
  },

  // Tests inside the Drizzle-allowed areas (schema, platform) keep that
  // area's rules from the blocks above.
  {
    files: TESTS,
    ignores: DRIZZLE_ALLOWED,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            cloudflareOnlyInPlatformExceptTests,
            drizzleOnlyInRepositories,
          ],
        },
      ],
    },
  },

  {
    files: TESTS,
    extends: [vitest.configs.recommended],
  },

  {
    files: ['e2e/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
  },

  {
    files: ['scripts/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  // Last: turn off rules that conflict with Prettier.
  prettier,

  // Braces around every if/else/loop body, so Prettier puts the body on its
  // own line. eslint-config-prettier turns curly off, but "all" is safe with
  // Prettier, so it is enabled after it.
  { rules: { curly: ['error', 'all'] } },
])
