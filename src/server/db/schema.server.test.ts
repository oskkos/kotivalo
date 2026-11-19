import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, test } from 'vitest'
import { createDb } from '#/server/platform/db.server'
import { properties, propertyAccess, user } from './schema'

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
      { propertyId: 'p1', userId: 'u1', role: 'owner', createdAt: now },
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
