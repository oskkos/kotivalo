// The backfill of migration 0008 (openspec: recurring-amounts, "Existing
// financing charges become unnamed charges"). The test database already has
// every migration, so the test stores periods as the previous version did,
// with no charge, and runs the migration's backfill statements on them.
import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, inject, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { recurringAmountRepository } from './recurring-amount.repository.server'

const db = createDb(env.DB)
const repo = recurringAmountRepository(db)
const now = new Date(Date.UTC(2026, 10, 23, 12, 0, 0))

const migration = inject('d1Migrations').find((m) => m.name.startsWith('0008_'))
const backfill = (migration?.queries ?? []).filter(
  (query) =>
    query.includes('INSERT INTO `financing_charges`') ||
    query.includes('UPDATE `recurring_amounts`'),
)

let flat = ''

beforeEach(async () => {
  await emptyTables(
    'recurring_amounts',
    'financing_charges',
    'financing_treatments',
    'ownership_periods',
    'property_invitations',
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
      '2025-03-01',
    )
  ).id
})

/** A period as the previous version stored it: no financing charge. */
async function storeOld(
  kind: string,
  amount: number,
  from: string,
  to: string | null,
) {
  await env.DB.prepare(
    'INSERT INTO recurring_amounts (id, property_id, kind, amount, valid_from, valid_to) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(crypto.randomUUID(), flat, kind, amount, from, to)
    .run()
}

async function runBackfill() {
  for (const query of backfill) {
    await env.DB.prepare(query).run()
  }
}

describe('Existing financing charges become unnamed charges', () => {
  test('the migration has its backfill statements', () => {
    expect(backfill).toHaveLength(2)
  })

  test("A flat's financing charge periods move to one unnamed charge", async () => {
    await storeOld('financing_charge', 8000, '2025-03-01', '2025-12-31')
    await storeOld('financing_charge', 8600, '2026-01-01', null)
    await storeOld('maintenance_charge', 21400, '2026-01-01', null)
    await runBackfill()
    const { financingCharges, amounts } = await repo.forProperty(flat)
    expect(financingCharges).toEqual([
      {
        id: expect.any(String) as string,
        name: null,
        periods: [
          { validFrom: '2025-03-01', validTo: '2025-12-31', value: 8000 },
          { validFrom: '2026-01-01', validTo: null, value: 8600 },
        ],
      },
    ])
    expect(amounts.maintenance_charge).toHaveLength(1)
  })

  test('A flat without a financing charge gets none', async () => {
    await storeOld('rent', 89000, '2025-03-01', null)
    await storeOld('maintenance_charge', 21400, '2026-01-01', null)
    await runBackfill()
    expect((await repo.forProperty(flat)).financingCharges).toEqual([])
  })
})
