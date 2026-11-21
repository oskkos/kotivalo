import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { recurringAmountRepository } from './recurring-amount.repository.server'

const db = createDb(env.DB)
const repo = recurringAmountRepository(db)
const now = new Date(Date.UTC(2026, 10, 20, 12, 0, 0))

let flat = ''
let other = ''

const details = {
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2 as const,
  floorArea: 485,
}

const amounts = async (kind: 'rent' | 'maintenance_charge') =>
  (await repo.forProperty(flat)).amounts[kind]

beforeEach(async () => {
  await emptyTables(
    'recurring_amounts',
    'financing_treatments',
    'ownership_periods',
    'property_invitations',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('annika')
  await addTestUser('jussi')
  flat = (
    await propertyRepository(db).create('annika', details, now, '2025-03-01')
  ).id
  other = (
    await propertyRepository(db).create('annika', details, now, '2025-03-01')
  ).id
  await env.DB.prepare(
    "INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, 'jussi', 'member', ?)",
  )
    .bind(flat, now.getTime())
    .run()
})

const set = (
  from: '2025-03-01' | '2026-01-01' | '2027-01-01',
  amount: number,
  latestStart: string | null,
  kind: 'rent' | 'maintenance_charge' = 'maintenance_charge',
  actorId = 'annika',
) =>
  repo.setAmount({
    propertyId: flat,
    actorId,
    kind,
    amount,
    from,
    latestStart: latestStart,
  })

describe('The recurring amount repository', () => {
  test('a flat without amounts has empty periods', async () => {
    expect(await repo.forProperty(flat)).toEqual({
      amounts: { rent: [], maintenance_charge: [], financing_charge: [] },
      treatments: [],
    })
  })

  test('the first amount starts an open period', async () => {
    expect(await set('2025-03-01', 20500, null)).toBe(true)
    expect(await amounts('maintenance_charge')).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 20500 },
    ])
  })

  test('a new amount closes the latest period the day before', async () => {
    await set('2025-03-01', 20500, null)
    expect(await set('2026-01-01', 21400, '2025-03-01')).toBe(true)
    expect(await amounts('maintenance_charge')).toEqual([
      { validFrom: '2025-03-01', validTo: '2025-12-31', value: 20500 },
      { validFrom: '2026-01-01', validTo: null, value: 21400 },
    ])
  })

  test('an amount on the latest start corrects that period', async () => {
    await set('2025-03-01', 20500, null)
    await set('2026-01-01', 21400, '2025-03-01')
    expect(await set('2026-01-01', 21900, '2026-01-01')).toBe(true)
    expect(await amounts('maintenance_charge')).toEqual([
      { validFrom: '2025-03-01', validTo: '2025-12-31', value: 20500 },
      { validFrom: '2026-01-01', validTo: null, value: 21900 },
    ])
  })

  test('a write against a stale latest period does not apply', async () => {
    await set('2025-03-01', 20500, null)
    await set('2026-01-01', 21400, '2025-03-01')
    expect(await set('2027-01-01', 22600, '2025-03-01')).toBe(false)
    expect(await set('2027-01-01', 22600, null)).toBe(false)
    expect(await amounts('maintenance_charge')).toHaveLength(2)
  })

  test('a member can not write', async () => {
    expect(
      await set('2025-03-01', 20500, null, 'maintenance_charge', 'jussi'),
    ).toBe(false)
    expect(await amounts('maintenance_charge')).toEqual([])
  })

  test('kinds and flats are separate', async () => {
    await set('2025-03-01', 20500, null)
    await set('2025-03-01', 89000, null, 'rent')
    await repo.setAmount({
      propertyId: other,
      actorId: 'annika',
      kind: 'rent',
      amount: 50000,
      from: '2026-01-01',
      latestStart: null,
    })
    expect(await amounts('rent')).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 89000 },
    ])
    expect(await amounts('maintenance_charge')).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 20500 },
    ])
  })

  test('undoing deletes the latest period and reopens the previous', async () => {
    await set('2025-03-01', 20500, null)
    await set('2026-01-01', 21400, '2025-03-01')
    expect(
      await repo.undoLatestAmount({
        propertyId: flat,
        actorId: 'annika',
        kind: 'maintenance_charge',
        latestStart: '2026-01-01',
        previousStart: '2025-03-01',
      }),
    ).toBe(true)
    expect(await amounts('maintenance_charge')).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 20500 },
    ])
  })

  test('a member can not undo', async () => {
    await set('2025-03-01', 20500, null)
    await set('2026-01-01', 21400, '2025-03-01')
    expect(
      await repo.undoLatestAmount({
        propertyId: flat,
        actorId: 'jussi',
        kind: 'maintenance_charge',
        latestStart: '2026-01-01',
        previousStart: '2025-03-01',
      }),
    ).toBe(false)
    expect(await amounts('maintenance_charge')).toHaveLength(2)
  })

  test('undoing the only period leaves the amount unset', async () => {
    await set('2025-03-01', 20500, null)
    await set('2025-03-01', 89000, null, 'rent')
    expect(
      await repo.undoLatestAmount({
        propertyId: flat,
        actorId: 'annika',
        kind: 'maintenance_charge',
        latestStart: '2025-03-01',
        previousStart: null,
      }),
    ).toBe(true)
    expect(await amounts('maintenance_charge')).toEqual([])
    expect(await amounts('rent')).toHaveLength(1)
  })

  test('undoing the only period does not apply after a new one was added', async () => {
    await set('2025-03-01', 20500, null)
    await set('2026-01-01', 21400, '2025-03-01')
    expect(
      await repo.undoLatestAmount({
        propertyId: flat,
        actorId: 'annika',
        kind: 'maintenance_charge',
        latestStart: '2025-03-01',
        previousStart: null,
      }),
    ).toBe(false)
    expect(await amounts('maintenance_charge')).toHaveLength(2)
  })

  test('a member can not undo the only period', async () => {
    await set('2025-03-01', 20500, null)
    expect(
      await repo.undoLatestAmount({
        propertyId: flat,
        actorId: 'jussi',
        kind: 'maintenance_charge',
        latestStart: '2025-03-01',
        previousStart: null,
      }),
    ).toBe(false)
    expect(await amounts('maintenance_charge')).toHaveLength(1)
  })

  test('the treatment is recorded as periods', async () => {
    const treat = (
      from: '2025-03-01' | '2027-01-01',
      treatment: 'capitalised' | 'income_recognised',
      latestStart: '2025-03-01' | '2027-01-01' | null,
    ) =>
      repo.setTreatment({
        propertyId: flat,
        actorId: 'annika',
        treatment,
        from,
        latestStart,
      })
    expect(await treat('2025-03-01', 'capitalised', null)).toBe(true)
    expect(await treat('2027-01-01', 'income_recognised', '2025-03-01')).toBe(
      true,
    )
    expect(await treat('2027-01-01', 'capitalised', '2027-01-01')).toBe(true)
    expect((await repo.forProperty(flat)).treatments).toEqual([
      { validFrom: '2025-03-01', validTo: '2026-12-31', value: 'capitalised' },
      { validFrom: '2027-01-01', validTo: null, value: 'capitalised' },
    ])
  })

  test('undoing the treatment reopens the previous period, then unsets it', async () => {
    const treat = (
      propertyId: string,
      from: '2025-03-01' | '2027-01-01',
      latestStart: '2025-03-01' | null,
    ) =>
      repo.setTreatment({
        propertyId,
        actorId: 'annika',
        treatment: 'capitalised',
        from,
        latestStart,
      })
    await treat(flat, '2025-03-01', null)
    await treat(flat, '2027-01-01', '2025-03-01')
    await treat(other, '2025-03-01', null)
    const undo = (
      latestStart: '2025-03-01' | '2027-01-01',
      previousStart: '2025-03-01' | null,
      actorId = 'annika',
    ) =>
      repo.undoLatestTreatment({
        propertyId: flat,
        actorId,
        latestStart,
        previousStart,
      })
    expect(await undo('2027-01-01', '2025-03-01', 'jussi')).toBe(false)
    expect(await undo('2025-03-01', null)).toBe(false)
    expect(await undo('2027-01-01', '2025-03-01')).toBe(true)
    expect((await repo.forProperty(flat)).treatments).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 'capitalised' },
    ])
    expect(await undo('2025-03-01', null)).toBe(true)
    expect((await repo.forProperty(flat)).treatments).toEqual([])
    expect((await repo.forProperty(other)).treatments).toHaveLength(1)
  })

  test('deleting a flat deletes its periods', async () => {
    await set('2025-03-01', 20500, null)
    await env.DB.prepare('DELETE FROM properties WHERE id = ?').bind(flat).run()
    const left = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM recurring_amounts',
    ).first<{ n: number }>()
    expect(left?.n).toBe(0)
  })
})

describe('Rent and charges are recorded as monthly periods', () => {
  test('A new amount ends the previous period the month before', async () => {
    await repo.setAmount({
      propertyId: flat,
      actorId: 'annika',
      kind: 'rent',
      amount: 89000,
      from: '2025-03-01',
      latestStart: null,
    })
    await repo.setAmount({
      propertyId: flat,
      actorId: 'annika',
      kind: 'rent',
      amount: 92000,
      from: '2027-03-01',
      latestStart: '2025-03-01',
    })
    expect(await amounts('rent')).toEqual([
      { validFrom: '2025-03-01', validTo: '2027-02-28', value: 89000 },
      { validFrom: '2027-03-01', validTo: null, value: 92000 },
    ])
  })
})
