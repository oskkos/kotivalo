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
let flatId = ''

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
  await addTestUser('jussi')
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
  await env.DB.prepare(
    "INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, 'jussi', 'member', ?)",
  )
    .bind(flat, now.getTime())
    .run()
  flatId = flat
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

describe("a tenancy's fee writes", () => {
  const newFee = (over: Partial<Parameters<typeof repo.addFee>[0]> = {}) => ({
    actorId: 'annika',
    propertyId: flatId,
    tenancyId: tenancy,
    kind: 'parking' as const,
    basis: 'fixed' as const,
    description: null,
    amount: 1500,
    from: '2026-02-01',
    ...over,
  })

  async function addParking() {
    const id = await repo.addFee(newFee())
    if (id === null) {
      throw new Error('the fee was not added')
    }
    return id
  }

  const amountsOf = async (feeId: string) =>
    (await repo.feesFor([tenancy]))[tenancy]?.find((f) => f.id === feeId)
      ?.amounts

  test('adds the fee with its first period together', async () => {
    const id = await addParking()
    expect(await amountsOf(id)).toEqual([
      { validFrom: '2026-02-01', validTo: null, value: 1500 },
    ])
  })

  test('a member or a stranger adds nothing', async () => {
    expect(await repo.addFee(newFee({ actorId: 'jussi' }))).toBeNull()
    expect(await repo.addFee(newFee({ propertyId: 'elsewhere' }))).toBeNull()
    expect(await repo.feesFor([tenancy])).toEqual({})
    const row = await env.DB.prepare(
      'SELECT count(*) AS n FROM tenant_fee_amounts',
    ).first<{ n: number }>()
    expect(row?.n).toBe(0)
  })

  test('a new amount closes the previous period the day before', async () => {
    const id = await addParking()
    expect(
      await repo.setFeeAmount({
        actorId: 'annika',
        propertyId: flatId,
        tenancyId: tenancy,
        feeId: id,
        amount: 2000,
        from: '2027-03-01',
        latestStart: '2026-02-01',
      }),
    ).toBe(true)
    expect(await amountsOf(id)).toEqual([
      { validFrom: '2026-02-01', validTo: '2027-02-28', value: 1500 },
      { validFrom: '2027-03-01', validTo: null, value: 2000 },
    ])
  })

  test('a stale latest start or a member changes nothing', async () => {
    const id = await addParking()
    const write = {
      actorId: 'annika',
      propertyId: flatId,
      tenancyId: tenancy,
      feeId: id,
      amount: 2000,
      from: '2027-03-01',
      latestStart: '2026-01-01',
    }
    expect(await repo.setFeeAmount(write)).toBe(false)
    expect(
      await repo.setFeeAmount({
        ...write,
        latestStart: '2026-02-01',
        actorId: 'jussi',
      }),
    ).toBe(false)
    expect(await amountsOf(id)).toHaveLength(1)
  })

  test("another tenancy's fee id changes nothing", async () => {
    const id = await addParking()
    expect(
      await repo.setFeeAmount({
        actorId: 'annika',
        propertyId: flatId,
        tenancyId: 'other-tenancy',
        feeId: id,
        amount: 1,
        from: '2027-03-01',
        latestStart: '2026-02-01',
      }),
    ).toBe(false)
  })

  test('undoing reopens the previous period', async () => {
    const id = await addParking()
    await repo.setFeeAmount({
      actorId: 'annika',
      propertyId: flatId,
      tenancyId: tenancy,
      feeId: id,
      amount: 0,
      from: '2027-01-01',
      latestStart: '2026-02-01',
    })
    expect(
      await repo.undoFeeChange({
        actorId: 'annika',
        propertyId: flatId,
        tenancyId: tenancy,
        feeId: id,
        latestStart: '2027-01-01',
        previousStart: '2026-02-01',
      }),
    ).toBe(true)
    expect(await amountsOf(id)).toEqual([
      { validFrom: '2026-02-01', validTo: null, value: 1500 },
    ])
  })

  test('undoing the only period removes the fee and leaves the others', async () => {
    const parking = await addParking()
    const sauna = await repo.addFee(
      newFee({ kind: 'sauna', amount: 1000, from: '2026-12-01' }),
    )
    expect(
      await repo.undoFeeChange({
        actorId: 'annika',
        propertyId: flatId,
        tenancyId: tenancy,
        feeId: sauna ?? '',
        latestStart: '2026-12-01',
        previousStart: null,
      }),
    ).toBe(true)
    const fees = (await repo.feesFor([tenancy]))[tenancy] ?? []
    expect(fees.map((f) => f.id)).toEqual([parking])
    const row = await env.DB.prepare(
      'SELECT count(*) AS n FROM tenant_fee_amounts',
    ).first<{ n: number }>()
    expect(row?.n).toBe(1)
  })

  test('a fee with several periods is not removed as the only one', async () => {
    const id = await addParking()
    await repo.setFeeAmount({
      actorId: 'annika',
      propertyId: flatId,
      tenancyId: tenancy,
      feeId: id,
      amount: 2000,
      from: '2027-03-01',
      latestStart: '2026-02-01',
    })
    expect(
      await repo.undoFeeChange({
        actorId: 'annika',
        propertyId: flatId,
        tenancyId: tenancy,
        feeId: id,
        latestStart: '2027-03-01',
        previousStart: null,
      }),
    ).toBe(false)
    expect(await amountsOf(id)).toHaveLength(2)
  })
})
