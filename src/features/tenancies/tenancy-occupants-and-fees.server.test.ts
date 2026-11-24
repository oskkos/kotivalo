// The occupants and tenant fees a tenancy is read with (openspec: tenancies,
// "Occupants of a tenancy", "Tenant fees are recorded as periods").
import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { tenancyRepository } from './tenancy.repository.server'

const db = createDb(env.DB)
const repo = tenancyRepository(db)
const now = new Date(Date.UTC(2026, 10, 24, 12, 0, 0))

let tenancy = ''

beforeEach(async () => {
  await emptyTables(
    'tenant_fee_amounts',
    'tenant_fees',
    'tenancy_occupants',
    'tenancy_rents',
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
    (await repo.create(
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
})

async function occupantsPeriod(
  persons: number,
  from: string,
  to: string | null,
) {
  await env.DB.prepare(
    'INSERT INTO tenancy_occupants (id, tenancy_id, persons, valid_from, valid_to) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(crypto.randomUUID(), tenancy, persons, from, to)
    .run()
}

async function fee(id: string, kind: string, basis: string, desc?: string) {
  await env.DB.prepare(
    'INSERT INTO tenant_fees (id, tenancy_id, kind, basis, description) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, tenancy, kind, basis, desc ?? null)
    .run()
}

async function feeAmount(
  feeId: string,
  amount: number,
  from: string,
  to: string | null,
) {
  await env.DB.prepare(
    'INSERT INTO tenant_fee_amounts (id, tenant_fee_id, amount, valid_from, valid_to) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(crypto.randomUUID(), feeId, amount, from, to)
    .run()
}

describe('The occupants of a tenancy', () => {
  test('are read as periods, oldest first', async () => {
    await occupantsPeriod(2, '2025-06-01', null)
    await occupantsPeriod(1, '2025-03-01', '2025-05-31')
    expect((await repo.occupantsFor([tenancy]))[tenancy]).toEqual([
      { validFrom: '2025-03-01', validTo: '2025-05-31', value: 1 },
      { validFrom: '2025-06-01', validTo: null, value: 2 },
    ])
  })

  test('a tenancy without any has no entry, and no tenancies read nothing', async () => {
    expect(await repo.occupantsFor([tenancy])).toEqual({})
    expect(await repo.occupantsFor([])).toEqual({})
  })
})

describe('The tenant fees of a tenancy', () => {
  test('are read with their amount periods, oldest first', async () => {
    await fee('water', 'water', 'per_occupant')
    await feeAmount('water', 1500, '2025-06-01', null)
    await feeAmount('water', 1200, '2025-03-01', '2025-05-31')
    await fee('sauna', 'other', 'fixed', 'Pyykkitupa')
    await feeAmount('sauna', 500, '2025-03-01', null)
    const fees = (await repo.feesFor([tenancy]))[tenancy] ?? []
    expect(fees).toHaveLength(2)
    expect(fees.find((f) => f.id === 'water')).toEqual({
      id: 'water',
      tenancyId: tenancy,
      kind: 'water',
      basis: 'per_occupant',
      description: null,
      amounts: [
        { validFrom: '2025-03-01', validTo: '2025-05-31', value: 1200 },
        { validFrom: '2025-06-01', validTo: null, value: 1500 },
      ],
    })
    expect(fees.find((f) => f.id === 'sauna')?.description).toBe('Pyykkitupa')
  })

  test('a tenancy without any has no entry', async () => {
    expect(await repo.feesFor([tenancy])).toEqual({})
    expect(await repo.feesFor([])).toEqual({})
  })
})
