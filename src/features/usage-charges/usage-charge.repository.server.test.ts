import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import {
  usageChargeRepository,
  type NewUsageCharge,
} from './usage-charge.repository.server'

const db = createDb(env.DB)
const repo = usageChargeRepository(db)
const now = new Date(Date.UTC(2026, 10, 24, 12, 0, 0))
const details = {
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2 as const,
  floorArea: 485,
}

let flat = ''
let other = ''

beforeEach(async () => {
  await emptyTables(
    'usage_charge_amounts',
    'usage_charges',
    'ownership_periods',
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

const water = (over: Partial<NewUsageCharge> = {}): NewUsageCharge => ({
  actorId: 'annika',
  propertyId: flat,
  kind: 'water',
  basis: 'per_occupant',
  description: null,
  amount: 2200,
  from: '2026-01-01',
  ...over,
})

describe('The usage charge repository', () => {
  test('adds a charge with its first period, and lists only the flat’s', async () => {
    const id = await repo.add(water())
    await repo.add(water({ propertyId: other }))
    expect(await repo.forProperty(flat)).toEqual([
      {
        id,
        kind: 'water',
        basis: 'per_occupant',
        description: null,
        periods: [{ validFrom: '2026-01-01', validTo: null, value: 2200 }],
      },
    ])
  })

  test('a member adds nothing', async () => {
    expect(await repo.add(water({ actorId: 'jussi' }))).toBeNull()
    expect(await repo.forProperty(flat)).toEqual([])
    const row = await env.DB.prepare(
      'SELECT count(*) AS n FROM usage_charge_amounts',
    ).first<{ n: number }>()
    expect(row?.n).toBe(0)
  })

  test('a new amount, a correction and an undo', async () => {
    const id = (await repo.add(water())) ?? ''
    const write = {
      actorId: 'annika',
      propertyId: flat,
      chargeId: id,
      amount: 2400,
      from: '2027-01-01',
      latestStart: '2026-01-01',
    }
    expect(await repo.setAmount(write)).toBe(true)
    expect(
      await repo.setAmount({
        ...write,
        amount: 2500,
        latestStart: '2027-01-01',
        corrects: true,
      }),
    ).toBe(true)
    expect((await repo.forProperty(flat))[0]?.periods).toEqual([
      { validFrom: '2026-01-01', validTo: '2026-12-31', value: 2200 },
      { validFrom: '2027-01-01', validTo: null, value: 2500 },
    ])
    expect(
      await repo.undoLatest({
        actorId: 'annika',
        propertyId: flat,
        chargeId: id,
        latestStart: '2027-01-01',
        previousStart: '2026-01-01',
      }),
    ).toBe(true)
    expect((await repo.forProperty(flat))[0]?.periods).toEqual([
      { validFrom: '2026-01-01', validTo: null, value: 2200 },
    ])
  })

  test('a stale write, another flat or a member changes nothing', async () => {
    const id = (await repo.add(water())) ?? ''
    const write = {
      actorId: 'annika',
      propertyId: flat,
      chargeId: id,
      amount: 2400,
      from: '2027-01-01',
      latestStart: '2025-01-01',
    }
    expect(await repo.setAmount(write)).toBe(false)
    expect(
      await repo.setAmount({
        ...write,
        latestStart: '2026-01-01',
        propertyId: other,
      }),
    ).toBe(false)
    expect(
      await repo.setAmount({
        ...write,
        latestStart: '2026-01-01',
        actorId: 'jussi',
      }),
    ).toBe(false)
    expect((await repo.forProperty(flat))[0]?.periods).toHaveLength(1)
  })

  test('undoing the only period removes the charge, leaving the others', async () => {
    const sauna = await repo.add(
      water({ kind: 'sauna', basis: 'fixed', amount: 1200 }),
    )
    const kept = await repo.add(water())
    expect(
      await repo.undoLatest({
        actorId: 'annika',
        propertyId: flat,
        chargeId: sauna ?? '',
        latestStart: '2026-01-01',
        previousStart: null,
      }),
    ).toBe(true)
    expect((await repo.forProperty(flat)).map((c) => c.id)).toEqual([kept])
  })
})
