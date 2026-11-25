import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import type { PropertyDetails } from './property'
import { propertyRepository } from './property.repository.server'

const db = createDb(env.DB)
const repository = propertyRepository(db)
const now = new Date(Date.UTC(2026, 10, 19, 12, 0, 0))

const kuusikuja: PropertyDetails = {
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2,
  floorArea: 485,
}

async function accessRows() {
  const { results } = await env.DB.prepare(
    'SELECT property_id, user_id, role FROM property_access',
  ).all()
  return results
}

beforeEach(async () => {
  await emptyTables('property_access', 'properties', 'user')
  await addTestUser('anna')
  await addTestUser('bertta')
})

describe('propertyRepository', () => {
  test('create gives the creator owner access and no one else', async () => {
    const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')

    expect(flat).toMatchObject(kuusikuja)
    expect(flat.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(await accessRows()).toEqual([
      { property_id: flat.id, user_id: 'anna', role: 'owner' },
    ])
  })

  test('finds and lists only flats the user has access to', async () => {
    const annas = await repository.create('anna', kuusikuja, now, '2022-06-12')
    const berttas = await repository.create(
      'bertta',
      { ...kuusikuja, streetAddress: 'Rantatie 15 C 21' },
      now,
      '2022-06-12',
    )

    expect(await repository.findForUser('anna', annas.id)).toEqual({
      ...annas,
      archivedAt: null,
    })
    expect(await repository.findForUser('anna', berttas.id)).toBeUndefined()
    expect(await repository.findForUser('anna', 'missing')).toBeUndefined()
    expect(await repository.listForUser('anna')).toEqual([annas])
    expect(await repository.listForUser('bertta')).toEqual([berttas])
  })

  test('update changes a flat the user has access to', async () => {
    const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')
    const changed = { ...kuusikuja, floorArea: 490, roomCount: 3 } as const

    expect(await repository.update('anna', flat.id, changed, now)).toBe(true)
    expect(await repository.findForUser('anna', flat.id)).toMatchObject({
      id: flat.id,
      ...changed,
    })
  })

  test('update leaves a flat without access unchanged', async () => {
    const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')

    expect(
      await repository.update(
        'bertta',
        flat.id,
        { ...kuusikuja, floorArea: 10 },
        now,
      ),
    ).toBe(false)
    expect(await repository.findForUser('anna', flat.id)).toMatchObject(flat)
  })

  test('counts the flats the user has access to', async () => {
    await repository.create('anna', kuusikuja, now, '2022-06-12')
    await repository.create('anna', kuusikuja, now, '2022-06-12')
    await repository.create('bertta', kuusikuja, now, '2022-06-12')

    expect(await repository.countForUser('anna')).toBe(2)
    expect(await repository.countForUser('bertta')).toBe(1)
  })

  describe('archiving', () => {
    const later = new Date(Date.UTC(2026, 10, 25, 9, 0, 0))

    async function share(propertyId: string, userId: string) {
      await env.DB.prepare(
        `INSERT INTO property_access (property_id, user_id, role, created_at)
         VALUES (?, ?, 'member', 0)`,
      )
        .bind(propertyId, userId)
        .run()
    }

    test('hides the flat only for the user who archived it', async () => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')
      await share(flat.id, 'bertta')

      expect(await repository.setArchived('anna', flat.id, later)).toBe(true)

      expect(await repository.listForUser('anna')).toEqual([])
      expect(await repository.listArchivedForUser('anna')).toEqual([
        { ...flat, archivedAt: later },
      ])
      expect(await repository.listForUser('bertta')).toEqual([flat])
      expect(await repository.listArchivedForUser('bertta')).toEqual([])
      expect(await repository.findForUser('anna', flat.id)).toMatchObject({
        archivedAt: later,
      })
    })

    test('restoring brings the flat back', async () => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')
      await repository.setArchived('anna', flat.id, later)

      expect(await repository.setArchived('anna', flat.id, null)).toBe(true)

      expect(await repository.listForUser('anna')).toEqual([flat])
      expect(await repository.listArchivedForUser('anna')).toEqual([])
    })

    test('archiving again keeps the first date', async () => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')
      await repository.setArchived('anna', flat.id, later)

      const again = new Date(later.getTime() + 86_400_000)
      expect(await repository.setArchived('anna', flat.id, again)).toBe(true)

      expect(await repository.findForUser('anna', flat.id)).toMatchObject({
        archivedAt: later,
      })
    })

    test("a user can't archive a flat without access", async () => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')

      expect(await repository.setArchived('bertta', flat.id, later)).toBe(false)
      expect(await repository.setArchived('bertta', flat.id, null)).toBe(false)
      expect(await repository.listForUser('anna')).toEqual([flat])
    })

    test('an archived flat is still counted', async () => {
      const flat = await repository.create('anna', kuusikuja, now, '2022-06-12')
      await repository.setArchived('anna', flat.id, later)

      expect(await repository.countForUser('anna')).toBe(1)
    })
  })
})
