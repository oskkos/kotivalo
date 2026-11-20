// The Drizzle schema: every table, in one module so drizzle-kit and the
// platform's Drizzle client see the same set. Tables land with the features
// (OpenSpec changes) that need them; build columns with the helpers in
// ./columns.ts.
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core'
import { id, instant, tenths } from './columns'

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

// Flats (openspec: properties). A flat belongs to no one by itself: users
// reach it through property_access, one row per user and flat.

export const properties = sqliteTable('properties', {
  id: id(),
  /** E.g. "Kuusikuja 3 B 12". */
  streetAddress: text('street_address').notNull(),
  /** Five digits, as text: leading zeros. */
  postcode: text('postcode').notNull(),
  city: text('city').notNull(),
  /** 1, 2, 3 or 4, where 4 means four rooms or more. */
  roomCount: integer('room_count', { mode: 'number' }).notNull(),
  /** In tenths of m²: 485 = 48,5 m². */
  floorArea: tenths('floor_area').notNull(),
  createdAt: instant('created_at').notNull(),
  updatedAt: instant('updated_at').notNull(),
})

/**
 * Roles a user can have on a flat (openspec: sharing): the `owner` added it
 * and manages who has access; a `member` accepted an invitation and can see
 * and edit the flat.
 */
export const PROPERTY_ROLES = ['owner', 'member'] as const
export type PropertyRole = (typeof PROPERTY_ROLES)[number]

export const propertyAccess = sqliteTable(
  'property_access',
  {
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role', { enum: PROPERTY_ROLES }).notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.propertyId, t.userId] }),
    index('property_access_user_id_idx').on(t.userId),
  ],
)

/**
 * Pending invitations to a flat, by email address: the invitee may have no
 * account yet. Accepting turns one into a property_access row; accepted,
 * declined and cancelled invitations are deleted (openspec: sharing).
 */
export const propertyInvitations = sqliteTable(
  'property_invitations',
  {
    id: id(),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    /** Lower-cased, as accounts store it. */
    email: text('email').notNull(),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: instant('created_at').notNull(),
    expiresAt: instant('expires_at').notNull(),
  },
  (t) => [
    unique('property_invitations_property_email').on(t.propertyId, t.email),
    index('property_invitations_email_idx').on(t.email),
  ],
)
