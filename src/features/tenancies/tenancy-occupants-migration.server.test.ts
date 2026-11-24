// The first occupants of migration 0010 (openspec: tenancies, "Existing
// tenancies get one occupant"). The test database already has every
// migration, so the test stores tenancies as the previous version did and
// runs the migration's statement on them.
import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, inject, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { tenancyRepository } from './tenancy.repository.server'

const db = createDb(env.DB)
const now = new Date(Date.UTC(2026, 10, 24, 12, 0, 0))

const migration = inject('d1Migrations').find((m) => m.name.startsWith('0010_'))
const give = (migration?.queries ?? []).filter((query) =>
  query.includes('INSERT INTO `tenancy_occupants`'),
)

let flat = ''

beforeEach(async () => {
  await emptyTables(
    'tenancy_occupants',
    'tenancies',
    'ownership_periods',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('annika')
  flat = (
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
      '2024-01-01',
    )
  ).id
})

async function storeTenancy(from: string, to: string | null): Promise<string> {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    "INSERT INTO tenancies (id, property_id, tenant_name, contract_type, contract_made, valid_from, valid_to, due_day, created_by, created_at, updated_at) VALUES (?, ?, 'Aino Koski', 'open_ended', ?, ?, ?, 5, 'annika', ?, ?)",
  )
    .bind(id, flat, from, from, to, now.getTime(), now.getTime())
    .run()
  return id
}

describe('Existing tenancies get one occupant', () => {
  test('the migration has its insert statement', () => {
    expect(give).toHaveLength(1)
  })

  test('An existing tenancy gets one occupant', async () => {
    const tenancy = await storeTenancy('2025-03-01', null)
    for (const query of give) {
      await env.DB.prepare(query).run()
    }
    expect(
      (await tenancyRepository(db).occupantsFor([tenancy]))[tenancy],
    ).toEqual([{ validFrom: '2025-03-01', validTo: null, value: 1 }])
  })

  test('an ended tenancy keeps its occupant open, bounded by the tenancy', async () => {
    const tenancy = await storeTenancy('2024-03-01', '2025-02-28')
    for (const query of give) {
      await env.DB.prepare(query).run()
    }
    expect(
      (await tenancyRepository(db).occupantsFor([tenancy]))[tenancy],
    ).toEqual([{ validFrom: '2024-03-01', validTo: null, value: 1 }])
  })
})
