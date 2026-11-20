// The account's own details that the app changes itself; Better Auth owns
// the rest of the user table (openspec: authentication).
import { eq } from 'drizzle-orm'
import type { Locale } from '#/paraglide/runtime.js'
import { user } from '#/server/db/schema'
import type { Db } from '#/server/platform/db.server'

export function userRepository(db: Db) {
  return {
    async setName(userId: string, name: string, now: Date): Promise<void> {
      await db
        .update(user)
        .set({ name, updatedAt: now })
        .where(eq(user.id, userId))
    },

    async setLocale(userId: string, locale: Locale, now: Date): Promise<void> {
      await db
        .update(user)
        .set({ locale, updatedAt: now })
        .where(eq(user.id, userId))
    },
  }
}

export type UserRepository = ReturnType<typeof userRepository>
