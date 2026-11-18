import { integer, text } from 'drizzle-orm/sqlite-core'

// Column helpers for the storage conventions in CLAUDE.md. They use only
// integer and text columns, so a later move to PostgreSQL is a schema
// rewrite with the same values.

/** A calendar date as ISO `YYYY-MM-DD`. */
export type IsoDate = string

/** Primary key: a random UUID as text, generated in the app. */
export const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

/** Money in integer cents (`123456` = 1 234,56 €). */
export const cents = (name: string) => integer(name, { mode: 'number' })

/** A share in integer basis points (`5000` = 50.00 %); shares sum to 10000. */
export const basisPoints = (name: string) => integer(name, { mode: 'number' })

/**
 * A point in time (e.g. when a session expires) as integer epoch
 * milliseconds, read and written as a `Date`. Not for calendar dates: those
 * are `isoDate()`.
 */
export const instant = (name: string) => integer(name, { mode: 'timestamp_ms' })

/** A calendar date stored as ISO `YYYY-MM-DD` text. */
export const isoDate = (name: string) => text(name).$type<IsoDate>()

/**
 * A validity period: `valid_from` is required, `valid_to` is open-ended when
 * null. Periods are never overwritten; a change ends one and starts the next.
 */
export const validity = () => ({
  validFrom: isoDate('valid_from').notNull(),
  validTo: isoDate('valid_to'),
})
