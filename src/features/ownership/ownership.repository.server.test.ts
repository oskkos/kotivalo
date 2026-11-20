import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { ownershipRepository } from './ownership.repository.server'

const db = createDb(env.DB)
const repo = ownershipRepository(db)
const now = new Date(Date.UTC(2026, 10, 20, 12, 0, 0))

let flat = ''

/** Adds Jussi to the flat as a member, straight into the database. */
async function addMember(userId: string) {
  await env.DB.prepare(
    "INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, ?, 'member', ?)",
  )
    .bind(flat, userId, now.getTime())
    .run()
}

const roles = async () =>
  (
    await env.DB.prepare(
      'SELECT user_id, role FROM property_access WHERE property_id = ? ORDER BY user_id',
    )
      .bind(flat)
      .all<{ user_id: string; role: string }>()
  ).results

/** Annika and Jussi 50 % each from 1 March 2025. */
const halves = () =>
  repo.change({
    propertyId: flat,
    actorId: 'annika',
    currentStart: '2022-06-12',
    from: '2025-03-01',
    reason: 'sale',
    split: [
      { userId: 'annika', share: 5000 },
      { userId: 'jussi', share: 5000 },
    ],
    removeAccess: [],
  })

beforeEach(async () => {
  await emptyTables(
    'ownership_periods',
    'property_invitations',
    'property_access',
    'properties',
    'user',
  )
  for (const [id, name] of [
    ['annika', 'Annika'],
    ['jussi', 'Jussi'],
    ['liisa', 'Liisa'],
  ] as const) {
    await addTestUser(id)
    await env.DB.prepare('UPDATE user SET name = ? WHERE id = ?')
      .bind(name, id)
      .run()
  }
  const created = await propertyRepository(db).create(
    'annika',
    {
      streetAddress: 'Kuusikuja 3 B 12',
      postcode: '33100',
      city: 'Tampere',
      roomCount: 2,
      floorArea: 485,
    },
    now,
    '2022-06-12',
  )
  flat = created.id
  await addMember('jussi')
})

describe('The first ownership period', () => {
  test('a new flat is owned 100 % by its creator from the given date', async () => {
    expect((await repo.history(flat)).periods).toEqual([
      {
        validFrom: '2022-06-12',
        validTo: null,
        reason: null,
        shares: [{ userId: 'annika', share: 10000 }],
      },
    ])
  })
})

describe('Ownership is recorded as periods', () => {
  test('A change ends the previous period the day before', async () => {
    expect(await halves()).toBe(true)

    const { periods, names } = await repo.history(flat)
    expect(periods).toEqual([
      {
        validFrom: '2025-03-01',
        validTo: null,
        reason: 'sale',
        shares: [
          expect.objectContaining({ share: 5000 }),
          expect.objectContaining({ share: 5000 }),
        ],
      },
      {
        validFrom: '2022-06-12',
        validTo: '2025-02-28',
        reason: null,
        shares: [{ userId: 'annika', share: 10000 }],
      },
    ])
    expect(names).toEqual({ annika: 'Annika', jussi: 'Jussi' })
  })
})

describe('Ownership repository', () => {
  test('a change sets the roles from the new shares', async () => {
    await halves()
    expect(await roles()).toEqual([
      { user_id: 'annika', role: 'owner' },
      { user_id: 'jussi', role: 'owner' },
    ])
  })

  test('a change can remove the access of someone going to 0 %', async () => {
    await halves()
    const applied = await repo.change({
      propertyId: flat,
      actorId: 'annika',
      currentStart: '2025-03-01',
      from: '2026-01-01',
      reason: 'sale',
      split: [
        { userId: 'annika', share: 10000 },
        { userId: 'jussi', share: 0 },
      ],
      removeAccess: ['jussi'],
    })

    expect(applied).toBe(true)
    expect(await roles()).toEqual([{ user_id: 'annika', role: 'owner' }])
    // His earlier share stays in the history.
    expect((await repo.history(flat)).periods).toHaveLength(3)
  })

  test('removeAccess never removes someone with a share', async () => {
    await repo.change({
      propertyId: flat,
      actorId: 'annika',
      currentStart: '2022-06-12',
      from: '2025-03-01',
      reason: 'gift',
      split: [
        { userId: 'annika', share: 5000 },
        { userId: 'jussi', share: 5000 },
      ],
      removeAccess: ['jussi'],
    })
    expect(await roles()).toHaveLength(2)
  })

  test('a change by a member changes nothing', async () => {
    const applied = await repo.change({
      propertyId: flat,
      actorId: 'jussi',
      currentStart: '2022-06-12',
      from: '2025-03-01',
      reason: 'sale',
      split: [{ userId: 'jussi', share: 10000 }],
      removeAccess: ['annika'],
    })

    expect(applied).toBe(false)
    expect((await repo.history(flat)).periods).toHaveLength(1)
    expect(await roles()).toEqual([
      { user_id: 'annika', role: 'owner' },
      { user_id: 'jussi', role: 'member' },
    ])
  })

  test('a correction by a member changes nothing', async () => {
    const applied = await repo.change({
      propertyId: flat,
      actorId: 'jussi',
      currentStart: '2022-06-12',
      from: '2022-06-12',
      reason: 'sale',
      split: [{ userId: 'jussi', share: 10000 }],
      removeAccess: [],
    })

    expect(applied).toBe(false)
    expect((await repo.history(flat)).periods).toEqual([
      expect.objectContaining({
        shares: [{ userId: 'annika', share: 10000 }],
      }),
    ])
  })

  test('a change against a period that has already changed does nothing', async () => {
    await halves()
    // Validated against the first period, which ended meanwhile.
    const applied = await repo.change({
      propertyId: flat,
      actorId: 'annika',
      currentStart: '2022-06-12',
      from: '2025-06-01',
      reason: 'gift',
      split: [{ userId: 'annika', share: 10000 }],
      removeAccess: [],
    })

    expect(applied).toBe(false)
    expect((await repo.history(flat)).periods).toHaveLength(2)
    expect(await roles()).toEqual([
      { user_id: 'annika', role: 'owner' },
      { user_id: 'jussi', role: 'owner' },
    ])
  })

  test('undo reopens the previous period and resets the roles', async () => {
    await halves()
    const { periods } = await repo.history(flat)
    const latest = periods.at(0)
    const previous = periods.at(1)
    if (!latest || !previous) {
      throw new Error('Expected two periods')
    }

    expect(
      await repo.undoLatest({
        propertyId: flat,
        actorId: 'annika',
        latest,
        previous,
      }),
    ).toBe(true)
    expect((await repo.history(flat)).periods).toEqual([
      {
        validFrom: '2022-06-12',
        validTo: null,
        reason: null,
        shares: [{ userId: 'annika', share: 10000 }],
      },
    ])
    expect(await roles()).toEqual([
      { user_id: 'annika', role: 'owner' },
      { user_id: 'jussi', role: 'member' },
    ])
  })

  test('undo by a member changes nothing', async () => {
    await repo.change({
      propertyId: flat,
      actorId: 'annika',
      currentStart: '2022-06-12',
      from: '2025-03-01',
      reason: 'sale',
      split: [
        { userId: 'annika', share: 5000 },
        { userId: 'liisa', share: 5000 },
      ],
      removeAccess: [],
    })
    const { periods } = await repo.history(flat)
    const latest = periods.at(0)
    const previous = periods.at(1)
    if (!latest || !previous) {
      throw new Error('Expected two periods')
    }

    expect(
      await repo.undoLatest({
        propertyId: flat,
        actorId: 'jussi',
        latest,
        previous,
      }),
    ).toBe(false)
    expect((await repo.history(flat)).periods).toHaveLength(2)
  })

  test('the first date can be corrected by an owner', async () => {
    expect(
      await repo.correctFirstDate({
        propertyId: flat,
        actorId: 'jussi',
        firstStart: '2022-06-12',
        date: '2020-01-01',
      }),
    ).toBe(false)
    expect(
      await repo.correctFirstDate({
        propertyId: flat,
        actorId: 'annika',
        firstStart: '2022-06-12',
        date: '2020-01-01',
      }),
    ).toBe(true)
    expect((await repo.history(flat)).periods[0]?.validFrom).toBe('2020-01-01')
  })

  test('currentForUser gives the current shares of the flats the user can see', async () => {
    await halves()

    expect(await repo.currentForUser('jussi')).toEqual(
      expect.arrayContaining([
        { propertyId: flat, userId: 'annika', name: 'Annika', share: 5000 },
        { propertyId: flat, userId: 'jussi', name: 'Jussi', share: 5000 },
      ]),
    )
    expect(await repo.currentForUser('liisa')).toEqual([])
  })
})
