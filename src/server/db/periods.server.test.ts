// The shared period statements, on the occupants of a tenancy and the
// amounts of a usage charge (openspec: tenancies "Occupants of a tenancy",
// usage-charges "Usage charges are recorded as monthly periods").
import { env } from 'cloudflare:workers'
import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { tenancyRepository } from '#/features/tenancies/tenancy.repository.server'
import { atomically, createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import {
  occupantsPeriods,
  periodUndoStatements,
  periodWriteStatements,
  usageChargePeriods,
  type PeriodTable,
  type PeriodWrite,
} from './periods'

const db = createDb(env.DB)
const now = new Date(Date.UTC(2026, 10, 24, 12, 0, 0))
const allowed = sql`1 = 1`
const denied = sql`1 = 0`

let tenancy = ''
let charge = ''

beforeEach(async () => {
  await emptyTables(
    'usage_charge_amounts',
    'usage_charges',
    'tenancy_occupants',
    'tenancies',
    'ownership_periods',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('annika')
  const flat = (
    await propertyRepository(db).create(
      'annika',
      {
        streetAddress: 'Kuusikuja 3 B 12',
        postcode: '33100',
        city: 'Tampere',
        roomCount: 2,
        floorArea: 485,
      },
      now,
      '2025-01-01',
    )
  ).id
  tenancy =
    (await tenancyRepository(db).create(
      'annika',
      flat,
      {
        tenantName: 'Aino Koski',
        tenantPhone: null,
        tenantEmail: null,
        contractType: 'open_ended',
        contractMade: '2025-02-12',
        validFrom: '2025-03-01',
        termEnd: null,
        dueDay: 5,
      },
      now,
    )) ?? ''
  charge = crypto.randomUUID()
  await env.DB.prepare(
    "INSERT INTO usage_charges (id, property_id, kind, basis) VALUES (?, ?, 'water', 'per_occupant')",
  )
    .bind(charge, flat)
    .run()
})

async function write(
  periods: PeriodTable,
  fields: Partial<PeriodWrite> & Pick<PeriodWrite, 'value' | 'from'>,
): Promise<boolean> {
  const parentId = periods === occupantsPeriods ? tenancy : charge
  const statements = periodWriteStatements(db, periods, {
    parentId,
    latestStart: null,
    owned: allowed,
    ...fields,
  })
  const results = await atomically(db, statements)
  return (results.at(-1) as unknown[]).length > 0
}

async function undo(
  periods: PeriodTable,
  fields: {
    latestStart: string
    previousStart: string
    owned?: typeof allowed
  },
): Promise<boolean> {
  const results = await atomically(
    db,
    periodUndoStatements(db, periods, {
      parentId: periods === occupantsPeriods ? tenancy : charge,
      owned: allowed,
      ...fields,
    }),
  )
  return (results[0] as unknown[]).length > 0
}

async function rows(table: string): Promise<unknown[]> {
  const result = await env.DB.prepare(
    `SELECT valid_from AS validFrom, valid_to AS validTo FROM ${table} ORDER BY valid_from`,
  ).all()
  return result.results
}

const occupantRows = async () =>
  (
    await env.DB.prepare(
      'SELECT persons, valid_from AS validFrom, valid_to AS validTo FROM tenancy_occupants ORDER BY valid_from',
    ).all()
  ).results

describe('The shared period statements', () => {
  test('a first period, then a change that closes it the day before', async () => {
    expect(
      await write(occupantsPeriods, { value: 1, from: '2025-03-01' }),
    ).toBe(true)
    expect(
      await write(occupantsPeriods, {
        value: 2,
        from: '2026-09-01',
        latestStart: '2025-03-01',
      }),
    ).toBe(true)
    expect(await occupantRows()).toEqual([
      { persons: 1, validFrom: '2025-03-01', validTo: '2026-08-31' },
      { persons: 2, validFrom: '2026-09-01', validTo: null },
    ])
  })

  test('correcting the latest period changes its value only', async () => {
    await write(occupantsPeriods, { value: 1, from: '2025-03-01' })
    expect(
      await write(occupantsPeriods, {
        value: 2,
        from: '2025-03-01',
        latestStart: '2025-03-01',
        corrects: true,
      }),
    ).toBe(true)
    expect(await occupantRows()).toEqual([
      { persons: 2, validFrom: '2025-03-01', validTo: null },
    ])
  })

  test('undoing deletes the latest period and reopens the previous', async () => {
    await write(occupantsPeriods, { value: 1, from: '2025-03-01' })
    await write(occupantsPeriods, {
      value: 2,
      from: '2026-12-01',
      latestStart: '2025-03-01',
    })
    expect(
      await undo(occupantsPeriods, {
        latestStart: '2026-12-01',
        previousStart: '2025-03-01',
      }),
    ).toBe(true)
    expect(await occupantRows()).toEqual([
      { persons: 1, validFrom: '2025-03-01', validTo: null },
    ])
  })

  test('usage charge amounts follow the same rules', async () => {
    await write(usageChargePeriods, { value: 2200, from: '2026-01-01' })
    await write(usageChargePeriods, {
      value: 0,
      from: '2026-09-01',
      latestStart: '2026-01-01',
    })
    expect(await rows('usage_charge_amounts')).toEqual([
      { validFrom: '2026-01-01', validTo: '2026-08-31' },
      { validFrom: '2026-09-01', validTo: null },
    ])
    expect(
      await undo(usageChargePeriods, {
        latestStart: '2026-09-01',
        previousStart: '2026-01-01',
      }),
    ).toBe(true)
    expect(await rows('usage_charge_amounts')).toEqual([
      { validFrom: '2026-01-01', validTo: null },
    ])
  })

  test('a concurrent write applies nothing', async () => {
    await write(occupantsPeriods, { value: 1, from: '2025-03-01' })
    await write(occupantsPeriods, {
      value: 2,
      from: '2026-09-01',
      latestStart: '2025-03-01',
    })
    // A second writer read the latest start before the change above.
    expect(
      await write(occupantsPeriods, {
        value: 3,
        from: '2026-10-01',
        latestStart: '2025-03-01',
      }),
    ).toBe(false)
    expect(await occupantRows()).toEqual([
      { persons: 1, validFrom: '2025-03-01', validTo: '2026-08-31' },
      { persons: 2, validFrom: '2026-09-01', validTo: null },
    ])
    expect(
      await undo(occupantsPeriods, {
        latestStart: '2026-10-01',
        previousStart: '2026-09-01',
      }),
    ).toBe(false)
  })

  test('a write without the owner check applies nothing', async () => {
    expect(
      await write(occupantsPeriods, {
        value: 1,
        from: '2025-03-01',
        owned: denied,
      }),
    ).toBe(false)
    await write(occupantsPeriods, { value: 1, from: '2025-03-01' })
    expect(
      await write(occupantsPeriods, {
        value: 2,
        from: '2026-09-01',
        latestStart: '2025-03-01',
        owned: denied,
      }),
    ).toBe(false)
    expect(
      await write(occupantsPeriods, {
        value: 2,
        from: '2025-03-01',
        latestStart: '2025-03-01',
        corrects: true,
        owned: denied,
      }),
    ).toBe(false)
    expect(await occupantRows()).toEqual([
      { persons: 1, validFrom: '2025-03-01', validTo: null },
    ])
  })
})
