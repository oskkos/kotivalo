import { defineConfig } from '@playwright/test'

const PORT = 4173
const baseURL = `http://localhost:${String(PORT)}`

// End-to-end tests run against the built app served by `vite preview`, which
// runs the Worker in workerd with local bindings (D1, R2) from wrangler.jsonc.
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      // Primary target: the phone size the UI is designed for (390 × 844).
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  // Migrations first: the local D1 database (.wrangler/state) starts empty in
  // CI and on a fresh checkout.
  webServer: {
    command: `pnpm db:migrate:local && pnpm run build && pnpm exec vite preview --port ${String(PORT)} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
