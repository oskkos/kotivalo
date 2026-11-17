import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'

// Three projects, chosen by file name:
//   *.test.ts         unit: pure functions, in Node
//   *.test.tsx        component: React components, in jsdom
//   *.server.test.ts  workers: server code in the Workers runtime (Miniflare),
//                     with the bindings from wrangler.jsonc
//
// The app's vite.config.ts is not reused: its Cloudflare and TanStack Start
// plugins build the app, they don't belong in a test run.
// The D1 migrations, read in Node and applied inside the Workers runtime by
// src/test/apply-migrations.server.ts before each Workers test file.
const d1Migrations = await readD1Migrations('./migrations')

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: ['src/**/*.server.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        plugins: [viteReact()],
        test: {
          name: 'component',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./src/test/setup-dom.ts'],
        },
      },
      {
        extends: true,
        plugins: [
          cloudflareTest({
            main: './src/test/worker-entry.ts',
            wrangler: { configPath: './wrangler.jsonc' },
          }),
        ],
        test: {
          name: 'workers',
          include: ['src/**/*.server.test.ts'],
          setupFiles: ['./src/test/apply-migrations.server.ts'],
          provide: { d1Migrations },
        },
      },
    ],
  },
})
