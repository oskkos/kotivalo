// The Drizzle schema: every table, in one module so drizzle-kit and the
// platform's Drizzle client see the same set. Tables land with the features
// (OpenSpec changes) that need them; build columns with the helpers in
// ./columns.ts.
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core'
import { id, instant } from './columns'

// Authentication (openspec: authentication). Better Auth's models: the
// property names are Better Auth's field names, so its Drizzle adapter maps
// them as they are; the columns are snake_case. Timestamps are instants.

export const user = sqliteTable('user', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
  image: text('image'),
  /** The user's language: 'fi', 'sv' or 'en'. */
  locale: text('locale').notNull(),
  createdAt: instant('created_at').notNull(),
  updatedAt: instant('updated_at').notNull(),
})

export const session = sqliteTable(
  'session',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: instant('expires_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
)

/** Linked sign-in methods (passwords, social providers). Unused by email codes. */
export const account = sqliteTable(
  'account',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: instant('access_token_expires_at'),
    refreshTokenExpiresAt: instant('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
)

/** One-time codes, stored hashed. */
export const verification = sqliteTable(
  'verification',
  {
    id: id(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: instant('expires_at').notNull(),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

/**
 * Request counters for abuse limits (platform/limits.server.ts), e.g. sign-in
 * code requests per IP address and per hashed email address.
 */
export const rateLimit = sqliteTable('rate_limit', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  windowStart: instant('window_start').notNull(),
})
