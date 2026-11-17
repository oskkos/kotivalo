import { defineConfig } from 'drizzle-kit'

// drizzle-kit only generates SQL migrations from the schema
// (pnpm db:generate). Wrangler applies them (pnpm db:migrate:local), and the
// Vitest Workers project applies them to the test database.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/db/schema.ts',
  out: './migrations',
})
