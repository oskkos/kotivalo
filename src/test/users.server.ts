// Users for Workers tests, straight into the test database: features' tests
// can't use Drizzle (ESLint), and signing in through Auth is slower than
// tests about other things need.
import { env } from 'cloudflare:workers'

/** Adds a user with the id `id` and the address `<id>@example.com`. */
export async function addTestUser(id: string): Promise<string> {
  const now = Date.UTC(2026, 10, 19)
  await env.DB.prepare(
    'INSERT INTO user (id, name, email, email_verified, locale, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)',
  )
    .bind(id, '', `${id}@example.com`, 'fi', now, now)
    .run()
  return id
}

/** Empties the given tables, children first. */
export async function emptyTables(...tables: string[]): Promise<void> {
  for (const table of tables) {
    await env.DB.exec(`DELETE FROM ${table}`)
  }
}
