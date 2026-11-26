import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { rentPaymentRepository } from '#/features/rent-payments/rent-payment.repository.server'
import {
  tenancyRepository,
  type TenancyFields,
} from '#/features/tenancies/tenancy.repository.server'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { depositReturnRepository } from './deposit-return.repository.server'

const db = createDb(env.DB)
const repo = depositReturnRepository(db)
const now = new Date(Date.UTC(2026, 10, 22, 12, 0, 0))

let flat = ''
let other = ''
let tenancy = ''
let otherTenancy = ''

const details = {
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2 as const,
  floorArea: 485,
}

const aino: TenancyFields = {
  tenantName: 'Aino Koski',
  tenantPhone: null,
  tenantEmail: null,
  contractType: 'fixed_term',
  contractMade: '2025-03-15',
  validFrom: '2025-03-15',
  termEnd: '2026-05-31',
  dueDay: 5,
  deposit: 178000,
}

const fields = {
  returnedOn: '2026-06-10',
  rentKept: 30000,
  damageKept: 20000,
  note: null,
}

const kept = [
  { month: '2026-04', amount: 20000 },
  { month: '2026-05', amount: 10000 },
]

async function recorded() {
  const id = await repo.record('annika', flat, tenancy, fields, kept, now)
  if (id === null) {
    throw new Error('the return was not recorded')
  }
  return id
}

async function payments(depositReturnId: string | null = null) {
  const { results } = await env.DB.prepare(
    depositReturnId === null
      ? 'SELECT month, amount, paid_on, deposit_return_id FROM rent_payments ORDER BY month'
      : 'SELECT month, amount, paid_on, deposit_return_id FROM rent_payments WHERE deposit_return_id = ? ORDER BY month',
  )
    .bind(...(depositReturnId === null ? [] : [depositReturnId]))
    .all()
  return results
}

beforeEach(async () => {
  await emptyTables(
    'rent_payments',
    'deposit_returns',
    'tenancies',
    'ownership_periods',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('annika')
  await addTestUser('matti')
  await addTestUser('stranger')
  flat = (
    await propertyRepository(db).create('annika', details, now, '2025-03-01')
  ).id
  other = (
    await propertyRepository(db).create('annika', details, now, '2025-03-01')
  ).id
  await env.DB.prepare(
    "INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, 'matti', 'member', ?)",
  )
    .bind(flat, now.getTime())
    .run()
  tenancy =
    (await tenancyRepository(db).create('annika', flat, aino, now)) ?? ''
  otherTenancy =
    (await tenancyRepository(db).create('annika', other, aino, now)) ?? ''
})

describe('The deposit return repository', () => {
  test('stores the deposit on the tenancy and reads it back', async () => {
    const read = await tenancyRepository(db).forProperty(flat)
    expect(read.find((t) => t.id === tenancy)?.deposit).toBe(178000)
  })

  test('records a return with its payments dated on the return date and reads it back', async () => {
    const id = await repo.record('annika', flat, tenancy, fields, kept, now)
    expect(id).not.toBe(null)
    expect(await repo.forTenancy(tenancy)).toEqual({
      id,
      tenancyId: tenancy,
      ...fields,
    })
    expect(await payments(id)).toEqual([
      {
        month: '2026-04',
        amount: 20000,
        paid_on: '2026-06-10',
        deposit_return_id: id,
      },
      {
        month: '2026-05',
        amount: 10000,
        paid_on: '2026-06-10',
        deposit_return_id: id,
      },
    ])
    const listed = await rentPaymentRepository(db).forProperty(flat)
    expect(listed.map((p) => p.depositReturnId)).toEqual([id, id])
  })

  test('records nothing for a member, a stranger, another flat or a second return', async () => {
    expect(await repo.record('matti', flat, tenancy, fields, kept, now)).toBe(
      null,
    )
    expect(
      await repo.record('stranger', flat, tenancy, fields, kept, now),
    ).toBe(null)
    expect(
      await repo.record('annika', flat, otherTenancy, fields, kept, now),
    ).toBe(null)
    expect(await repo.forTenancy(tenancy)).toBeUndefined()
    expect(await payments()).toEqual([])

    expect(
      await repo.record('annika', flat, tenancy, fields, kept, now),
    ).not.toBe(null)
    expect(await repo.record('annika', flat, tenancy, fields, [], now)).toBe(
      null,
    )
    expect(await payments()).toHaveLength(2)
  })

  test('a second return for a tenancy fails on the unique index', async () => {
    await repo.record('annika', flat, tenancy, fields, [], now)
    await expect(
      env.DB.prepare(
        `INSERT INTO deposit_returns (id, tenancy_id, returned_on, rent_kept, damage_kept, created_by, created_at, updated_at)
         VALUES ('again', ?, '2026-06-11', 0, 0, 'annika', 0, 0)`,
      )
        .bind(tenancy)
        .run(),
    ).rejects.toThrow()
  })

  test('correcting replaces the payments and keeps the others', async () => {
    await rentPaymentRepository(db).record(
      'annika',
      flat,
      {
        tenancyId: tenancy,
        month: '2026-03',
        amount: 89000,
        paidOn: '2026-03-04',
      },
      now,
    )
    const id = await recorded()
    const changed = await repo.update(
      'annika',
      flat,
      id,
      { ...fields, returnedOn: '2026-06-12', rentKept: 5000, damageKept: 0 },
      [{ month: '2026-04', amount: 5000 }],
      now,
    )
    expect(changed).toBe(true)
    expect((await repo.forTenancy(tenancy))?.rentKept).toBe(5000)
    expect(await payments()).toEqual([
      {
        month: '2026-03',
        amount: 89000,
        paid_on: '2026-03-04',
        deposit_return_id: null,
      },
      {
        month: '2026-04',
        amount: 5000,
        paid_on: '2026-06-12',
        deposit_return_id: id,
      },
    ])
  })

  test('correcting changes nothing for a member, a stranger or another flat', async () => {
    const id = await recorded()
    for (const [actor, propertyId] of [
      ['matti', flat],
      ['stranger', flat],
      ['annika', other],
    ] as const) {
      expect(
        await repo.update(
          actor,
          propertyId,
          id,
          { ...fields, rentKept: 0 },
          [],
          now,
        ),
      ).toBe(false)
    }
    expect((await repo.forTenancy(tenancy))?.rentKept).toBe(30000)
    expect(await payments(id)).toHaveLength(2)
  })

  test('deleting a return deletes its payments through the cascade', async () => {
    const id = await recorded()
    expect(await repo.remove('matti', flat, id)).toBe(false)
    expect(await repo.remove('annika', other, id)).toBe(false)
    expect(await payments()).toHaveLength(2)

    expect(await repo.remove('annika', flat, id)).toBe(true)
    expect(await repo.forTenancy(tenancy)).toBeUndefined()
    expect(await payments()).toEqual([])
  })

  test('lists the returns of flats dated in a year, oldest first', async () => {
    await repo.record('annika', flat, tenancy, fields, [], now)
    await repo.record(
      'annika',
      other,
      otherTenancy,
      { ...fields, returnedOn: '2026-02-01' },
      [],
      now,
    )
    const list = await repo.forPropertiesYear([flat, other], 2026)
    expect(list.map((r) => [r.propertyId, r.returnedOn])).toEqual([
      [other, '2026-02-01'],
      [flat, '2026-06-10'],
    ])
    expect(await repo.forPropertiesYear([flat, other], 2025)).toEqual([])
    expect(await repo.forPropertiesYear([], 2026)).toEqual([])
    expect(await repo.forTenancies([tenancy, otherTenancy])).toHaveLength(2)
  })
})

describe('A deposit return stays inside its tenancy', () => {
  test('Deleting a flat removes its deposit returns', async () => {
    const id = await recorded()
    expect(await propertyRepository(db).deleteGuarded('annika', flat)).toBe(
      true,
    )
    expect(await repo.forTenancy(tenancy)).toBeUndefined()
    expect(await payments(id)).toEqual([])
  })
})
