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
import {
  basisPoints,
  cents,
  id,
  instant,
  isoDate,
  tenths,
  validity,
} from './columns'

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

/** Why ownership changed; the first period has none. */
export const OWNERSHIP_REASONS = [
  'sale',
  'gift',
  'inheritance',
  'division',
  'other',
] as const
export type OwnershipReason = (typeof OWNERSHIP_REASONS)[number]

/**
 * Who owns how much of a flat, from when (openspec: ownership). One row per
 * owner and period; a period is the rows with the same `valid_from`. A
 * change closes the open rows and adds the new split, so rows are never
 * overwritten. A 0 % share has no row: that person is a member.
 */
export const ownershipPeriods = sqliteTable(
  'ownership_periods',
  {
    id: id(),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Basis points: 5000 = 50 %. A period's shares add up to 10000. */
    share: basisPoints('share').notNull(),
    ...validity(),
    /** Null for the first period, which records how the flat was acquired. */
    reason: text('reason', { enum: OWNERSHIP_REASONS }),
  },
  (t) => [
    index('ownership_periods_property_idx').on(t.propertyId, t.validFrom),
  ],
)

/** The monthly amounts a flat has (openspec: recurring-amounts). */
export const RECURRING_AMOUNT_KINDS = [
  'rent',
  'maintenance_charge',
  'financing_charge',
] as const
export type RecurringAmountKind = (typeof RECURRING_AMOUNT_KINDS)[number]

/**
 * A flat's financing charges (openspec: recurring-amounts): a housing company
 * can collect several at once, e.g. one per renovation loan. Their amounts
 * are periods in recurring_amounts; the treatment is the flat's, one for all.
 */
export const financingCharges = sqliteTable(
  'financing_charges',
  {
    id: id(),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    /**
     * Null only for the charge each flat got when financing charges became
     * several; the UI shows it as the term's word in the user's language.
     */
    name: text('name'),
  },
  (t) => [index('financing_charges_property_idx').on(t.propertyId)],
)

/**
 * Rent and charges over time (openspec: recurring-amounts). One row per
 * sequence and period: the rent, the maintenance charge, or one financing
 * charge (`financing_charge_id`, set on every financing_charge row). Every
 * period starts on the first of a month. A change closes the open row the
 * day before and adds the next, so rows are never overwritten. Monthly
 * amounts are computed from these rows, never stored.
 */
export const recurringAmounts = sqliteTable(
  'recurring_amounts',
  {
    id: id(),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: RECURRING_AMOUNT_KINDS }).notNull(),
    /** The financing charge a financing_charge row belongs to; else null. */
    financingChargeId: text('financing_charge_id').references(
      () => financingCharges.id,
      { onDelete: 'cascade' },
    ),
    /** Per month, in cents. */
    amount: cents('amount').notNull(),
    ...validity(),
  },
  (t) => [
    index('recurring_amounts_property_idx').on(
      t.propertyId,
      t.kind,
      t.validFrom,
    ),
    index('recurring_amounts_financing_charge_idx').on(
      t.financingChargeId,
      t.validFrom,
    ),
  ],
)

/** How the housing company books a flat's financing charge. */
export const FINANCING_TREATMENTS = [
  'income_recognised',
  'capitalised',
] as const
export type FinancingTreatment = (typeof FINANCING_TREATMENTS)[number]

/**
 * The financing charge's treatment over time (openspec: recurring-amounts):
 * income-recognised charges are deductible, capitalised ones add to the
 * acquisition cost. Periods like recurring_amounts.
 */
export const financingTreatments = sqliteTable(
  'financing_treatments',
  {
    id: id(),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    treatment: text('treatment', { enum: FINANCING_TREATMENTS }).notNull(),
    ...validity(),
  },
  (t) => [
    index('financing_treatments_property_idx').on(t.propertyId, t.validFrom),
  ],
)

/** Whether an entry is money in or out (openspec: transactions). */
export const TRANSACTION_TYPES = ['income', 'expense'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

/**
 * Entry categories (openspec: transactions). Each belongs to one type and
 * decides the form 7H row; the mapping is in features/transactions/
 * categories.ts. The codes describe the cost, not the row, so a row change
 * needs no migration.
 */
export const TRANSACTION_CATEGORIES = [
  'tenant_water_charge',
  'other_income',
  'annual_repair',
  'improvement',
  'water_charge',
  'insurance',
  'other_expense',
] as const
export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number]

/**
 * Logged income and expenses of a flat (openspec: transactions). Plain rows,
 * edited and deleted in place; rent and the monthly charges are periods in
 * recurring_amounts, never entries. The amount is positive; the type gives
 * the sign.
 */
export const transactions = sqliteTable(
  'transactions',
  {
    id: id(),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    type: text('type', { enum: TRANSACTION_TYPES }).notNull(),
    category: text('category', { enum: TRANSACTION_CATEGORIES }).notNull(),
    /** Positive, in cents. */
    amount: cents('amount').notNull(),
    date: isoDate('date').notNull(),
    note: text('note'),
    /** Who logged it; kept when another owner edits it. */
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (t) => [index('transactions_property_date_idx').on(t.propertyId, t.date)],
)

/**
 * An entry's receipt (openspec: transactions): the file is in FileStorage
 * under `key`, generated by newFileKey(); D1 keeps the metadata. One per
 * entry. `uploadedBy` counts the file against that user's storage quota.
 */
export const receipts = sqliteTable(
  'receipts',
  {
    id: id(),
    transactionId: text('transaction_id')
      .notNull()
      .unique()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    contentType: text('content_type').notNull(),
    /** In bytes. */
    size: integer('size', { mode: 'number' }).notNull(),
    /** The name the browser gave, shown and used for downloads only. */
    filename: text('filename').notNull(),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => user.id),
    createdAt: instant('created_at').notNull(),
  },
  (t) => [index('receipts_uploaded_by_idx').on(t.uploadedBy)],
)

/** A tenancy's contract (openspec: tenancies). */
export const CONTRACT_TYPES = ['open_ended', 'fixed_term'] as const
export type ContractType = (typeof CONTRACT_TYPES)[number]

/**
 * How a tenancy was ended (openspec: tenancies): by the tenant's or the
 * landlord's notice, by agreement, with a court's permission (a fixed term
 * ended early), or on another legal ground such as rescission or an
 * estate's notice, which has no notice period the app checks.
 */
export const NOTICE_GIVERS = [
  'tenant',
  'landlord',
  'agreed',
  'court',
  'other',
] as const
export type NoticeGiver = (typeof NOTICE_GIVERS)[number]

/**
 * A flat's tenancies (openspec: tenancies), each a period: `valid_to` is the
 * last day (the fixed term's end, or the last rent day once ended), null
 * while an open-ended tenancy runs. `term_end` keeps a fixed term's end so
 * that cancelling an early ending restores it. A flat's tenancies never
 * overlap. The tenant's details are a third party's personal data: never
 * logged.
 */
export const tenancies = sqliteTable(
  'tenancies',
  {
    id: id(),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    tenantName: text('tenant_name').notNull(),
    tenantPhone: text('tenant_phone'),
    tenantEmail: text('tenant_email'),
    contractType: text('contract_type', { enum: CONTRACT_TYPES }).notNull(),
    /** Decides the landlord's notice period (CONCEPT.md §4.2). */
    contractMade: isoDate('contract_made').notNull(),
    ...validity(),
    /** A fixed term's end; null for an open-ended tenancy. */
    termEnd: isoDate('term_end'),
    /** Day of the month, 1–31; the month's last day in shorter months. */
    dueDay: integer('due_day', { mode: 'number' }).notNull(),
    noticeGivenBy: text('notice_given_by', { enum: NOTICE_GIVERS }),
    /** The date notice was received, or the ending agreed or permitted. */
    noticeDate: isoDate('notice_date'),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (t) => [index('tenancies_property_idx').on(t.propertyId, t.validFrom)],
)

/**
 * Rent received for a month of a tenancy (openspec: rent-payments). `month`
 * (`YYYY-MM`) is the rent's month, `paid_on` the day it was received, which
 * decides its tax year. A month may have several payments. Never edited: a
 * wrong one is deleted and recorded again. Payments stay inside their
 * tenancy's months; text comparison of `month` orders it correctly.
 */
export const rentPayments = sqliteTable(
  'rent_payments',
  {
    id: id(),
    tenancyId: text('tenancy_id')
      .notNull()
      .references(() => tenancies.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    /** Positive, in cents. */
    amount: cents('amount').notNull(),
    paidOn: isoDate('paid_on').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id),
    createdAt: instant('created_at').notNull(),
  },
  (t) => [index('rent_payments_tenancy_month_idx').on(t.tenancyId, t.month)],
)
