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

const amounts = async (kind: 'maintenance_charge') =>
  (await repo.forProperty(flat)).amounts[kind]

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
  kind: 'maintenance_charge' = 'maintenance_charge',
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
      amounts: { maintenance_charge: [] },
      financingCharges: [],
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

  test('flats are separate', async () => {
    await set('2025-03-01', 20500, null)
    await repo.setAmount({
      propertyId: other,
      actorId: 'annika',
      kind: 'maintenance_charge',
      amount: 50000,
      from: '2026-01-01',
      latestStart: null,
    })
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

describe('Charges are recorded as monthly periods', () => {
  test('A new amount ends the previous period the month before', async () => {
    await set('2026-01-01', 21400, null)
    await set('2027-01-01', 22600, '2026-01-01')
    expect(await amounts('maintenance_charge')).toEqual([
      { validFrom: '2026-01-01', validTo: '2026-12-31', value: 21400 },
      { validFrom: '2027-01-01', validTo: null, value: 22600 },
    ])
  })
})

describe('Financing charges in the repository', () => {
  const add = (
    chargeId: string,
    name: string,
    amount: number,
    from: string,
    propertyId = flat,
    actorId = 'annika',
  ) =>
    repo.addFinancingCharge({
      propertyId,
      actorId,
      chargeId,
      name,
      amount,
      from,
    })
  const setCharge = (
    chargeId: string,
    amount: number,
    from: string,
    latestStart: string | null,
  ) =>
    repo.setAmount({
      propertyId: flat,
      actorId: 'annika',
      kind: 'financing_charge',
      chargeId,
      amount,
      from,
      latestStart,
    })
  const charges = async () => (await repo.forProperty(flat)).financingCharges

  describe('Charges are recorded as monthly periods', () => {
    test('Each financing charge has its own periods', async () => {
      expect(await add('putki', 'Putkiremontti', 8600, '2025-03-01')).toBe(true)
      expect(await add('julkisivu', 'Julkisivu', 4200, '2026-01-01')).toBe(true)
      expect(
        await setCharge('julkisivu', 4500, '2027-01-01', '2026-01-01'),
      ).toBe(true)
      expect(await charges()).toEqual([
        {
          id: 'putki',
          name: 'Putkiremontti',
          periods: [{ validFrom: '2025-03-01', validTo: null, value: 8600 }],
        },
        {
          id: 'julkisivu',
          name: 'Julkisivu',
          periods: [
            { validFrom: '2026-01-01', validTo: '2026-12-31', value: 4200 },
            { validFrom: '2027-01-01', validTo: null, value: 4500 },
          ],
        },
      ])
    })
  })

  test("a new period can't join another flat's charge", async () => {
    await add('muu', 'Muu', 1000, '2025-03-01', other)
    expect(await setCharge('muu', 2000, '2026-01-01', null)).toBe(false)
    expect(await charges()).toEqual([])
    expect(
      (await repo.forProperty(other)).financingCharges[0]?.periods,
    ).toEqual([{ validFrom: '2025-03-01', validTo: null, value: 1000 }])
  })

  test('a member adds no charge, and nothing is stored', async () => {
    expect(
      await add('putki', 'Putkiremontti', 8600, '2025-03-01', flat, 'jussi'),
    ).toBe(false)
    expect(await charges()).toEqual([])
  })

  test('renaming changes the name only', async () => {
    await add('putki', 'Putki', 8600, '2025-03-01')
    expect(
      await repo.renameFinancingCharge({
        propertyId: flat,
        actorId: 'annika',
        chargeId: 'putki',
        name: 'Putkiremontti',
      }),
    ).toBe(true)
    expect(await charges()).toEqual([
      {
        id: 'putki',
        name: 'Putkiremontti',
        periods: [{ validFrom: '2025-03-01', validTo: null, value: 8600 }],
      },
    ])
    expect(
      await repo.renameFinancingCharge({
        propertyId: other,
        actorId: 'annika',
        chargeId: 'putki',
        name: 'Muu',
      }),
    ).toBe(false)
  })

  test("undoing a charge's only period removes the charge", async () => {
    await add('putki', 'Putkiremontti', 8600, '2025-03-01')
    await add('julkisivu', 'Julkisivu', 4200, '2026-01-01')
    expect(
      await repo.undoLatestAmount({
        propertyId: flat,
        actorId: 'annika',
        kind: 'financing_charge',
        chargeId: 'julkisivu',
        latestStart: '2026-01-01',
        previousStart: null,
      }),
    ).toBe(true)
    expect((await charges()).map((charge) => charge.id)).toEqual(['putki'])
  })

  test('undoing a later period keeps the charge', async () => {
    await add('putki', 'Putkiremontti', 8600, '2025-03-01')
    await setCharge('putki', 0, '2026-01-01', '2025-03-01')
    expect(
      await repo.undoLatestAmount({
        propertyId: flat,
        actorId: 'annika',
        kind: 'financing_charge',
        chargeId: 'putki',
        latestStart: '2026-01-01',
        previousStart: '2025-03-01',
      }),
    ).toBe(true)
    expect(await charges()).toEqual([
      {
        id: 'putki',
        name: 'Putkiremontti',
        periods: [{ validFrom: '2025-03-01', validTo: null, value: 8600 }],
      },
    ])
  })
})
