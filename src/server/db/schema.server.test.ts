import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, inject, test } from 'vitest'
import { createDb } from '#/server/platform/db.server'
import {
  ownershipPeriods,
  properties,
  propertyAccess,
  propertyInvitations,
  user,
} from './schema'

const db = createDb(env.DB)
const now = new Date(Date.UTC(2026, 10, 19, 12, 0, 0))

async function addUser(id: string) {
  await db.insert(user).values({
    id,
    name: '',
    email: `${id}@example.com`,
    locale: 'fi',
    createdAt: now,
    updatedAt: now,
  })
}

async function addProperty(id: string) {
  await db.insert(properties).values({
    id,
    streetAddress: 'Kuusikuja 3 B 12',
    postcode: '33100',
    city: 'Tampere',
    roomCount: 2,
    floorArea: 485,
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(async () => {
  await db.delete(ownershipPeriods)
  await db.delete(propertyInvitations)
  await db.delete(propertyAccess)
  await db.delete(properties)
  await db.delete(user)
})

describe('Properties tables', () => {
  test('store a flat and its access', async () => {
    await addUser('u1')
    await addProperty('p1')
    await db
      .insert(propertyAccess)
      .values({ propertyId: 'p1', userId: 'u1', role: 'owner', createdAt: now })

    expect(await db.select().from(properties)).toEqual([
      expect.objectContaining({ id: 'p1', floorArea: 485, roomCount: 2 }),
    ])
    expect(await db.select().from(propertyAccess)).toEqual([
      {
        propertyId: 'p1',
        userId: 'u1',
        role: 'owner',
        createdAt: now,
        archivedAt: null,
      },
    ])
  })

  test('allow one access row per user and flat', async () => {
    await addUser('u1')
    await addProperty('p1')
    const row = {
      propertyId: 'p1',
      userId: 'u1',
      role: 'owner',
      createdAt: now,
    } as const
    await db.insert(propertyAccess).values(row)
    await expect(db.insert(propertyAccess).values(row)).rejects.toThrow()
  })

  test('refuse access to a flat that does not exist', async () => {
    await addUser('u1')
    await expect(
      db.insert(propertyAccess).values({
        propertyId: 'missing',
        userId: 'u1',
        role: 'owner',
        createdAt: now,
      }),
    ).rejects.toThrow()
  })

  test('remove a deleted user’s access but keep the flat', async () => {
    await addUser('u1')
    await addProperty('p1')
    await db
      .insert(propertyAccess)
      .values({ propertyId: 'p1', userId: 'u1', role: 'owner', createdAt: now })

    await db.delete(user).where(eq(user.id, 'u1'))

    expect(await db.select().from(propertyAccess)).toEqual([])
    expect(await db.select().from(properties)).toHaveLength(1)
  })
})

describe('Invitations table', () => {
  const invitation = {
    id: 'i1',
    propertyId: 'p1',
    email: 'jussi@example.com',
    invitedBy: 'u1',
    createdAt: now,
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  }

  beforeEach(async () => {
    await addUser('u1')
    await addProperty('p1')
  })

  test('allow one invitation per flat and address', async () => {
    await db.insert(propertyInvitations).values(invitation)
    await expect(
      db.insert(propertyInvitations).values({ ...invitation, id: 'i2' }),
    ).rejects.toThrow()
  })

  test('are removed with their flat', async () => {
    await db.insert(propertyInvitations).values(invitation)
    await db.delete(properties).where(eq(properties.id, 'p1'))
    expect(await db.select().from(propertyInvitations)).toEqual([])
  })

  test('are removed with the user who sent them', async () => {
    await db.insert(propertyInvitations).values(invitation)
    await db.delete(user).where(eq(user.id, 'u1'))
    expect(await db.select().from(propertyInvitations)).toEqual([])
  })
})

describe('Ownership periods table', () => {
  beforeEach(async () => {
    await addUser('u1')
    await addProperty('p1')
  })

  const period = {
    id: 'o1',
    propertyId: 'p1',
    userId: 'u1',
    share: 10000,
    validFrom: '2022-06-12',
    validTo: null,
    reason: null,
  }

  test('store a share with its validity', async () => {
    await db.insert(ownershipPeriods).values(period)
    expect(await db.select().from(ownershipPeriods)).toEqual([period])
  })

  test('are removed with their flat', async () => {
    await db.insert(ownershipPeriods).values(period)
    await db.delete(properties).where(eq(properties.id, 'p1'))
    expect(await db.select().from(ownershipPeriods)).toEqual([])
  })

  test('are removed with their user', async () => {
    await db.insert(ownershipPeriods).values(period)
    await db.delete(user).where(eq(user.id, 'u1'))
    expect(await db.select().from(ownershipPeriods)).toEqual([])
  })

  test('the migration gives each existing owner 100 % from the day the flat was added', async () => {
    await addUser('u2')
    await db.insert(propertyAccess).values([
      { propertyId: 'p1', userId: 'u1', role: 'owner', createdAt: now },
      { propertyId: 'p1', userId: 'u2', role: 'member', createdAt: now },
    ])
    const backfill = inject('d1Migrations')
      .find((m) => m.name.startsWith('0003_'))
      ?.queries.find((q) => q.includes('INSERT INTO `ownership_periods`'))
    expect(backfill).toBeDefined()

    await env.DB.prepare(backfill ?? '').run()

    expect(await db.select().from(ownershipPeriods)).toEqual([
      expect.objectContaining({
        propertyId: 'p1',
        userId: 'u1',
        share: 10000,
        // `now` is 2026-11-19 12:00 UTC.
        validFrom: '2026-11-19',
        validTo: null,
        reason: null,
      }),
    ])
  })
})
