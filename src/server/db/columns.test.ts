import { getTableConfig, sqliteTable } from 'drizzle-orm/sqlite-core'
import { describe, expect, test } from 'vitest'
import { basisPoints, cents, id, isoDate, validity } from './columns'

const example = sqliteTable('example', {
  id: id(),
  amount: cents('amount').notNull(),
  share: basisPoints('share').notNull(),
  paidOn: isoDate('paid_on'),
  ...validity(),
})

const columns = Object.fromEntries(
  getTableConfig(example).columns.map((c) => [
    c.name,
    { type: c.getSQLType(), notNull: c.notNull, primary: c.primary },
  ]),
)

describe('Column helpers', () => {
  test('store money and shares as integers and dates as text', () => {
    expect(columns).toEqual({
      id: { type: 'text', notNull: true, primary: true },
      amount: { type: 'integer', notNull: true, primary: false },
      share: { type: 'integer', notNull: true, primary: false },
      paid_on: { type: 'text', notNull: false, primary: false },
      valid_from: { type: 'text', notNull: true, primary: false },
      valid_to: { type: 'text', notNull: false, primary: false },
    })
  })

  test('generate a UUID primary key', () => {
    const generate = example.id.defaultFn
    expect(generate?.()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})
