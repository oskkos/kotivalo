import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { recurringAmountRepository } from '#/features/recurring-amounts/recurring-amount.repository.server'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import {
  tenancyRepository,
  type TenancyFields,
} from './tenancy.repository.server'

const db = createDb(env.DB)
const repo = tenancyRepository(db)
const now = new Date(Date.UTC(2026, 10, 22, 12, 0, 0))

let flat = ''
let other = ''

const details = {
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2 as const,
  floorArea: 485,
}

const aino: TenancyFields = {
  tenantName: 'Aino Koski',
  tenantPhone: '040 123 4567',
  tenantEmail: 'aino@example.com',
  contractType: 'open_ended',
  contractMade: '2025-02-12',
  validFrom: '2025-03-01',
  termEnd: null,
  dueDay: 5,
}

const fixed = (from: string, to: string): TenancyFields => ({
  ...aino,
  tenantName: 'Mikko Lehtinen',
  contractType: 'fixed_term',
  contractMade: from,
  validFrom: from,
  termEnd: to,
})

beforeEach(async () => {
  await emptyTables(
    'tenancies',
    'recurring_amounts',
    'ownership_periods',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('annika')
  await addTestUser('matti')
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
})

describe('The tenancy repository', () => {
  test("lists a flat's tenancies newest first, leaving other flats out", async () => {
    await repo.create('annika', flat, fixed('2023-06-01', '2025-02-28'), now)
    await repo.create('annika', flat, aino, now)
    await repo.create('annika', other, aino, now)
    const list = await repo.forProperty(flat)
    expect(list.map((t) => t.tenantName)).toEqual([
      'Aino Koski',
      'Mikko Lehtinen',
    ])
    expect(list[0]).toMatchObject({
      validTo: null,
      noticeGivenBy: null,
      dueDay: 5,
      tenantEmail: 'aino@example.com',
    })
    expect(list[1]?.validTo).toBe('2025-02-28')
  })

  test('an overlapping insert writes nothing, also against an earlier tenancy', async () => {
    await repo.create('annika', flat, fixed('2025-01-01', '2025-12-31'), now)
    expect(
      await repo.create('annika', flat, fixed('2025-12-31', '2026-06-30'), now),
    ).toBeNull()
    expect(
      await repo.create('annika', flat, fixed('2024-06-01', '2025-01-01'), now),
    ).toBeNull()
    expect(
      await repo.create('annika', flat, fixed('2024-01-01', '2024-12-31'), now),
    ).not.toBeNull()
    expect(await repo.create('annika', flat, aino, now)).toBeNull()
    expect(await repo.forProperty(flat)).toHaveLength(2)
  })

  test('nothing can follow an open-ended tenancy that runs', async () => {
    await repo.create('annika', flat, aino, now)
    expect(
      await repo.create('annika', flat, fixed('2030-01-01', '2030-12-31'), now),
    ).toBeNull()
  })

  test("a member's writes write nothing", async () => {
    expect(await repo.create('matti', flat, aino, now)).toBeNull()
    const id = await repo.create('annika', flat, aino, now)
    expect(id).not.toBeNull()
    const tenancyId = id ?? ''
    expect(
      await repo.update(
        'matti',
        flat,
        tenancyId,
        { ...aino, tenantPhone: '040 765 4321' },
        { validTo: null, expectedValidTo: null },
        now,
      ),
    ).toBe(false)
    expect(
      await repo.end(
        'matti',
        flat,
        tenancyId,
        {
          noticeGivenBy: 'tenant',
          noticeDate: '2026-11-22',
          lastDay: '2026-12-31',
        },
        now,
      ),
    ).toBe(false)
    expect((await repo.get(tenancyId))?.tenantPhone).toBe('040 123 4567')
  })

  test('an update that would overlap writes nothing', async () => {
    await repo.create('annika', flat, fixed('2023-06-01', '2025-02-28'), now)
    const id = (await repo.create('annika', flat, aino, now)) ?? ''
    expect(
      await repo.update(
        'annika',
        flat,
        id,
        { ...aino, validFrom: '2025-02-15' },
        { validTo: null, expectedValidTo: null },
        now,
      ),
    ).toBe(false)
    expect(
      await repo.update(
        'annika',
        flat,
        id,
        { ...aino, tenantPhone: '040 765 4321' },
        { validTo: null, expectedValidTo: null },
        now,
      ),
    ).toBe(true)
    expect((await repo.get(id))?.tenantPhone).toBe('040 765 4321')
  })

  test('ending and cancelling set and restore the last day', async () => {
    const open = (await repo.create('annika', flat, aino, now)) ?? ''
    const ending = {
      noticeGivenBy: 'tenant' as const,
      noticeDate: '2026-11-22',
      lastDay: '2026-12-31',
    }
    expect(await repo.end('annika', flat, open, ending, now)).toBe(true)
    expect(await repo.end('annika', flat, open, ending, now)).toBe(false)
    expect(await repo.get(open)).toMatchObject({
      validTo: '2026-12-31',
      noticeGivenBy: 'tenant',
      noticeDate: '2026-11-22',
    })
    const stored = await repo.get(open)
    expect(stored).not.toBeNull()
    if (!stored) {
      return
    }
    expect(await repo.cancelEnding('annika', flat, stored, now)).toBe(true)
    expect(await repo.get(open)).toMatchObject({
      validTo: null,
      noticeGivenBy: null,
      noticeDate: null,
    })

    const term = fixed('2027-01-01', '2027-12-31')
    const fixedId = (await repo.create('annika', other, term, now)) ?? ''
    await repo.end(
      'annika',
      other,
      fixedId,
      {
        noticeGivenBy: 'agreed',
        noticeDate: '2027-05-15',
        lastDay: '2027-06-30',
      },
      now,
    )
    const ended = await repo.get(fixedId)
    expect(ended?.validTo).toBe('2027-06-30')
    if (!ended) {
      return
    }
    expect(await repo.cancelEnding('annika', other, ended, now)).toBe(true)
    expect((await repo.get(fixedId))?.validTo).toBe('2027-12-31')
  })

  test('cancelling writes nothing when a later tenancy follows', async () => {
    const open = (await repo.create('annika', flat, aino, now)) ?? ''
    await repo.end(
      'annika',
      flat,
      open,
      {
        noticeGivenBy: 'tenant',
        noticeDate: '2026-11-22',
        lastDay: '2026-12-31',
      },
      now,
    )
    await repo.create('annika', flat, fixed('2027-01-01', '2027-12-31'), now)
    const stored = await repo.get(open)
    if (!stored) {
      throw new Error('missing tenancy')
    }
    expect(await repo.cancelEnding('annika', flat, stored, now)).toBe(false)
  })

  test('the current tenancies of several flats leave out ended ones', async () => {
    await repo.create('annika', flat, fixed('2023-06-01', '2025-02-28'), now)
    await repo.create('annika', flat, aino, now)
    await repo.create('annika', other, fixed('2027-01-01', '2027-12-31'), now)
    const current = await repo.currentFor([flat, other], '2026-11-22')
    expect(current.map((t) => [t.propertyId, t.validFrom])).toEqual([
      [flat, '2025-03-01'],
      [other, '2027-01-01'],
    ])
    expect(await repo.currentFor([], '2026-11-22')).toEqual([])
  })

  test('the rent is set with a new tenancy, and only if the tenancy went in', async () => {
    const rents = recurringAmountRepository(db)
    await rents.setAmount({
      propertyId: flat,
      actorId: 'annika',
      kind: 'rent',
      latestStart: null,
      from: '2025-03-01',
      amount: 89000,
    })
    const rent = {
      latestStart: '2025-03-01',
      from: '2027-01-01',
      amount: 91000,
    }
    await repo.create('annika', flat, aino, now)
    const refused = await repo.createWithRent(
      'annika',
      flat,
      fixed('2027-01-15', '2027-12-31'),
      rent,
      now,
    )
    expect(refused).toEqual({ outcome: 'overlaps' })
    expect((await rents.forProperty(flat)).amounts.rent).toHaveLength(1)

    const added = await repo.createWithRent(
      'annika',
      other,
      fixed('2027-01-15', '2027-12-31'),
      null,
      now,
    )
    expect(added.outcome).toBe('created')

    await emptyTables('tenancies')
    const both = await repo.createWithRent(
      'annika',
      flat,
      fixed('2027-01-15', '2027-12-31'),
      rent,
      now,
    )
    expect(both.outcome).toBe('created')
    expect((await rents.forProperty(flat)).amounts.rent).toEqual([
      { validFrom: '2025-03-01', validTo: '2026-12-31', value: 89000 },
      { validFrom: '2027-01-01', validTo: null, value: 91000 },
    ])
  })

  test('a stale rent leaves neither the tenancy nor the rent', async () => {
    const result = await repo.createWithRent(
      'annika',
      flat,
      aino,
      { latestStart: '2024-01-01', from: '2025-03-01', amount: 89000 },
      now,
    )
    expect(result).toEqual({ outcome: 'rent_changed' })
    expect(await repo.forProperty(flat)).toEqual([])
    expect(
      (await recurringAmountRepository(db).forProperty(flat)).amounts.rent,
    ).toEqual([])
  })

  test('an earlier tenancy with its ending goes in before a later one', async () => {
    await repo.create('annika', flat, aino, now)
    const pekka = {
      ...aino,
      tenantName: 'Pekka Virtanen',
      validFrom: '2023-06-01',
    }
    // Without the ending it runs indefinitely and overlaps Aino's.
    expect(await repo.createWithRent('annika', flat, pekka, null, now)).toEqual(
      {
        outcome: 'overlaps',
      },
    )
    const ending = {
      noticeGivenBy: 'tenant' as const,
      noticeDate: '2025-01-20',
      lastDay: '2025-02-28',
    }
    const added = await repo.createWithRent(
      'annika',
      flat,
      pekka,
      null,
      now,
      ending,
    )
    expect(added.outcome).toBe('created')
    expect((await repo.forProperty(flat))[1]).toMatchObject({
      tenantName: 'Pekka Virtanen',
      validTo: '2025-02-28',
      noticeGivenBy: 'tenant',
      noticeDate: '2025-01-20',
    })
    // The ending's last day is the end for the overlap.
    expect(
      await repo.createWithRent('annika', flat, pekka, null, now, {
        ...ending,
        lastDay: '2025-03-01',
      }),
    ).toEqual({ outcome: 'overlaps' })
  })

  test('only a tenancy that has not started can be removed, by an owner', async () => {
    const id =
      (await repo.create(
        'annika',
        flat,
        fixed('2027-01-01', '2027-12-31'),
        now,
      )) ?? ''
    expect(await repo.removeNotStarted('matti', flat, id, '2026-11-22')).toBe(
      false,
    )
    expect(await repo.removeNotStarted('annika', other, id, '2026-11-22')).toBe(
      false,
    )
    expect(await repo.removeNotStarted('annika', flat, id, '2027-01-01')).toBe(
      false,
    )
    expect(await repo.get(id)).not.toBeNull()
    expect(await repo.removeNotStarted('annika', flat, id, '2026-12-31')).toBe(
      true,
    )
    expect(await repo.get(id)).toBeNull()
  })

  test('deleting a flat deletes its tenancies', async () => {
    await repo.create('annika', flat, aino, now)
    await env.DB.prepare('DELETE FROM properties WHERE id = ?').bind(flat).run()
    expect(await repo.forProperty(flat)).toEqual([])
  })

  test("reads tenancies' rent periods oldest first, by tenancy", async () => {
    const first = await repo.create(
      'annika',
      flat,
      fixed('2023-06-01', '2025-02-28'),
      now,
    )
    const second = await repo.create('annika', flat, aino, now)
    const rent = (
      tenancy: string | null,
      amount: number,
      from: string,
      to: string | null,
    ) =>
      env.DB.prepare(
        'INSERT INTO tenancy_rents (id, tenancy_id, amount, valid_from, valid_to) VALUES (?, ?, ?, ?, ?)',
      )
        .bind(crypto.randomUUID(), tenancy, amount, from, to)
        .run()
    await rent(second, 92000, '2026-03-01', null)
    await rent(second, 89000, '2025-03-01', '2026-02-28')
    await rent(first, 82000, '2023-06-01', null)
    expect(await repo.rentsFor([])).toEqual({})
    const rents = await repo.rentsFor([second ?? ''])
    expect(rents).toEqual({
      [second ?? '']: [
        { validFrom: '2025-03-01', validTo: '2026-02-28', value: 89000 },
        { validFrom: '2026-03-01', validTo: null, value: 92000 },
      ],
    })
  })

  test('removing a tenancy removes its rent periods', async () => {
    const id = await repo.create(
      'annika',
      flat,
      fixed('2027-01-01', '2027-12-31'),
      now,
    )
    await env.DB.prepare(
      'INSERT INTO tenancy_rents (id, tenancy_id, amount, valid_from, valid_to) VALUES (?, ?, 91000, ?, NULL)',
    )
      .bind(crypto.randomUUID(), id, '2027-01-01')
      .run()
    expect(
      await repo.removeNotStarted('annika', flat, id ?? '', '2026-11-22'),
    ).toBe(true)
    expect(await repo.rentsFor([id ?? ''])).toEqual({})
  })
})
