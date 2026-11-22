import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import {
  tenancyRepository,
  type TenancyFields,
} from '#/features/tenancies/tenancy.repository.server'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { rentPaymentRepository } from './rent-payment.repository.server'

const db = createDb(env.DB)
const repo = rentPaymentRepository(db)
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
  termEnd: '2026-12-14',
  dueDay: 5,
}

const payment = (month: string, amount = 89000) => ({
  tenancyId: tenancy,
  month,
  amount,
  paidOn: `${month}-04`,
})

beforeEach(async () => {
  await emptyTables(
    'rent_payments',
    'tenancies',
    'ownership_periods',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('annika')
  await addTestUser('matti')
  await addTestUser('stranger')
  await env.DB.prepare("UPDATE user SET name = 'Annika V.' WHERE id = 'annika'")
    .bind()
    .run()
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

describe('The rent payment repository', () => {
  test("lists a flat's payments by month and date with who recorded them, leaving other flats out", async () => {
    await repo.record('annika', flat, payment('2026-11', 39000), now)
    await repo.record(
      'annika',
      flat,
      { ...payment('2026-11', 50000), paidOn: '2026-11-02' },
      now,
    )
    await repo.record('annika', flat, payment('2026-10'), now)
    await repo.record(
      'annika',
      other,
      { ...payment('2026-10'), tenancyId: otherTenancy },
      now,
    )
    const list = await repo.forProperty(flat)
    expect(list.map((p) => [p.month, p.paidOn, p.amount])).toEqual([
      ['2026-10', '2026-10-04', 89000],
      ['2026-11', '2026-11-02', 50000],
      ['2026-11', '2026-11-04', 39000],
    ])
    expect(list[0]?.recordedBy).toBe('Annika V.')
  })

  test('records a payment in the first and the last month of the tenancy', async () => {
    expect(await repo.record('annika', flat, payment('2025-03'), now)).not.toBe(
      null,
    )
    expect(await repo.record('annika', flat, payment('2026-12'), now)).not.toBe(
      null,
    )
  })

  test('a month outside the tenancy writes nothing', async () => {
    expect(await repo.record('annika', flat, payment('2025-02'), now)).toBe(
      null,
    )
    expect(await repo.record('annika', flat, payment('2027-01'), now)).toBe(
      null,
    )
    expect(await repo.forProperty(flat)).toEqual([])
  })

  test("a member's or a stranger's write writes nothing", async () => {
    expect(await repo.record('matti', flat, payment('2026-11'), now)).toBe(null)
    expect(await repo.record('stranger', flat, payment('2026-11'), now)).toBe(
      null,
    )
    const id = await repo.record('annika', flat, payment('2026-11'), now)
    expect(await repo.remove('matti', flat, id ?? '')).toBe(false)
    expect(await repo.remove('stranger', flat, id ?? '')).toBe(false)
    expect(await repo.forProperty(flat)).toHaveLength(1)
  })

  test("another flat's tenancy or payment is left alone", async () => {
    expect(
      await repo.record(
        'annika',
        flat,
        { ...payment('2026-11'), tenancyId: otherTenancy },
        now,
      ),
    ).toBe(null)
    const id = await repo.record(
      'annika',
      other,
      { ...payment('2026-11'), tenancyId: otherTenancy },
      now,
    )
    expect(await repo.remove('annika', flat, id ?? '')).toBe(false)
    expect(await repo.forProperty(other)).toHaveLength(1)
  })

  test("reads several flats' payments for one month, leaving other months and flats out", async () => {
    await repo.record('annika', flat, payment('2026-11'), now)
    await repo.record('annika', flat, payment('2026-11', 1000), now)
    await repo.record('annika', flat, payment('2026-10'), now)
    await repo.record(
      'annika',
      other,
      { ...payment('2026-11'), tenancyId: otherTenancy },
      now,
    )
    const rows = await repo.forMonth([flat], '2026-11')
    expect(rows).toHaveLength(2)
    expect(rows).toContainEqual({
      propertyId: flat,
      tenancyId: tenancy,
      month: '2026-11',
      amount: 1000,
      paidOn: '2026-11-04',
    })
    expect(await repo.forMonth([flat, other], '2026-11')).toHaveLength(3)
    expect(await repo.forMonth([], '2026-11')).toEqual([])
  })

  test('an owner deletes a payment', async () => {
    const id = await repo.record('annika', flat, payment('2026-11'), now)
    expect(await repo.remove('annika', flat, id ?? '')).toBe(true)
    expect(await repo.forProperty(flat)).toEqual([])
  })

  test('removing a tenancy removes its payments', async () => {
    await repo.record('annika', flat, payment('2026-11'), now)
    await env.DB.prepare('DELETE FROM tenancies WHERE id = ?')
      .bind(tenancy)
      .run()
    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM rent_payments',
    ).first<{ n: number }>()
    expect(count?.n).toBe(0)
  })
})
