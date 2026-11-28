import { join } from 'node:path'
import { defineConfig } from '@playwright/test'

const PORT = 4173
const baseURL = `http://localhost:${String(PORT)}`
const ROOT = join(import.meta.dirname, '../..')

// The guide's screenshots (design.md, decision 6): the built app under
// `vite preview`, as in the e2e tests, at the phone size. The demo project
// fills in the demo accounts in English, with the e2e helpers; the language
// projects then walk each page's capture script with those accounts. Only
// Finnish for now.
export default defineConfig({
  testDir: './capture',
  outputDir: join(ROOT, 'test-results/guide'),
  globalSetup: './capture/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    trace: 'off',
  },
  projects: [
    {
      name: 'demo',
      testMatch: /demo\.setup\.ts/,
      use: { locale: 'en-US' },
    },
    {
      name: 'fi',
      testMatch: /\.capture\.ts/,
      dependencies: ['demo'],
      use: { locale: 'fi-FI' },
    },
  ],
  webServer: {
    command: `pnpm db:migrate:local && pnpm run build && pnpm exec vite preview --port ${String(PORT)} --strictPort`,
    cwd: ROOT,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
