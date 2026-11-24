// The rent move of migration 0009 (openspec: tenancies, "Existing rents move
// to their tenancies"). The test database already has every migration, so
// the test stores rents as the previous version did, on the flat, and runs
// the migration's copy and delete statements on them.
import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, inject, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { tenancyRepository } from './tenancy.repository.server'

const db = createDb(env.DB)
const repo = tenancyRepository(db)
const now = new Date(Date.UTC(2026, 10, 24, 12, 0, 0))

const migration = inject('d1Migrations').find((m) => m.name.startsWith('0009_'))
const move = (migration?.queries ?? []).filter(
  (query) =>
    query.includes('INSERT INTO `tenancy_rents`') ||
    query.includes('DELETE FROM `recurring_amounts`'),
)

let flat = ''

beforeEach(async () => {
  await emptyTables(
    'tenancy_rents',
    'tenancies',
    'recurring_amounts',
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

/** A rent period as the previous version stored it: on the flat. */
async function storeOldRent(amount: number, from: string, to: string | null) {
  await env.DB.prepare(
    "INSERT INTO recurring_amounts (id, property_id, kind, amount, valid_from, valid_to) VALUES (?, ?, 'rent', ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), flat, amount, from, to)
    .run()
}

async function storeTenancy(
  name: string,
  from: string,
  to: string | null,
): Promise<string> {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    "INSERT INTO tenancies (id, property_id, tenant_name, contract_type, contract_made, valid_from, valid_to, due_day, created_by, created_at, updated_at) VALUES (?, ?, ?, 'open_ended', ?, ?, ?, 5, 'annika', ?, ?)",
  )
    .bind(id, flat, name, from, from, to, now.getTime(), now.getTime())
    .run()
  return id
}

async function runMove() {
  for (const query of move) {
    await env.DB.prepare(query).run()
  }
}

async function oldRentRows(): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT count(*) AS n FROM recurring_amounts WHERE kind = 'rent'",
  ).first<{ n: number }>()
  return row?.n ?? 0
}

describe('Existing rents move to their tenancies', () => {
  test('the migration has its copy and delete statements', () => {
    expect(move).toHaveLength(2)
  })

  test('A rent spanning a tenant change is split', async () => {
    await storeOldRent(80000, '2025-01-01', '2026-10-31')
    await storeOldRent(90000, '2026-11-01', null)
    const pekka = await storeTenancy(
      'Pekka Virtanen',
      '2025-01-01',
      '2026-11-14',
    )
    const aino = await storeTenancy('Aino Koski', '2026-11-15', null)
    await runMove()
    const rents = await repo.rentsFor([pekka, aino])
    expect(rents[pekka]).toEqual([
      { validFrom: '2025-01-01', validTo: '2026-10-31', value: 80000 },
      { validFrom: '2026-11-01', validTo: null, value: 90000 },
    ])
    expect(rents[aino]).toEqual([
      { validFrom: '2026-11-15', validTo: null, value: 90000 },
    ])
    expect(await oldRentRows()).toBe(0)
  })

  test('Rent outside every tenancy is left out', async () => {
    await storeOldRent(89000, '2025-03-01', null)
    await runMove()
    const row = await env.DB.prepare(
      'SELECT count(*) AS n FROM tenancy_rents',
    ).first<{ n: number }>()
    expect(row?.n).toBe(0)
    expect(await oldRentRows()).toBe(0)
  })

  test('A tenancy that started before the rent was set', async () => {
    await storeOldRent(89000, '2025-01-01', null)
    const tenancy = await storeTenancy('Aino Koski', '2024-06-01', null)
    await runMove()
    expect((await repo.rentsFor([tenancy]))[tenancy]).toEqual([
      { validFrom: '2025-01-01', validTo: null, value: 89000 },
    ])
  })

  test('a rent ending before a tenancy starts is not copied to it', async () => {
    await storeOldRent(80000, '2024-01-01', '2024-12-31')
    await storeOldRent(85000, '2025-01-01', null)
    const tenancy = await storeTenancy('Aino Koski', '2025-03-01', null)
    await runMove()
    expect((await repo.rentsFor([tenancy]))[tenancy]).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 85000 },
    ])
  })
})
