import { applyD1Migrations, type D1Migration } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { inject } from 'vitest'

declare module 'vitest' {
  export interface ProvidedContext {
    d1Migrations: D1Migration[]
  }
}

// Brings the local test database up to date. Applied migrations are recorded
// in d1_migrations, so running this before every test file is cheap.
await applyD1Migrations(env.DB, inject('d1Migrations'))
