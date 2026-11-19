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
    const flat = await repository.create('anna', kuusikuja, now)

    expect(flat).toMatchObject(kuusikuja)
    expect(flat.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(await accessRows()).toEqual([
      { property_id: flat.id, user_id: 'anna', role: 'owner' },
    ])
  })

  test('finds and lists only flats the user has access to', async () => {
    const annas = await repository.create('anna', kuusikuja, now)
    const berttas = await repository.create(
      'bertta',
      { ...kuusikuja, streetAddress: 'Rantatie 15 C 21' },
      now,
    )

    expect(await repository.findForUser('anna', annas.id)).toEqual(annas)
    expect(await repository.findForUser('anna', berttas.id)).toBeUndefined()
    expect(await repository.findForUser('anna', 'missing')).toBeUndefined()
    expect(await repository.listForUser('anna')).toEqual([annas])
    expect(await repository.listForUser('bertta')).toEqual([berttas])
  })

  test('update changes a flat the user has access to', async () => {
    const flat = await repository.create('anna', kuusikuja, now)
    const changed = { ...kuusikuja, floorArea: 490, roomCount: 3 } as const

    expect(await repository.update('anna', flat.id, changed, now)).toBe(true)
    expect(await repository.findForUser('anna', flat.id)).toEqual({
      id: flat.id,
      ...changed,
    })
  })

  test('update leaves a flat without access unchanged', async () => {
    const flat = await repository.create('anna', kuusikuja, now)

    expect(
      await repository.update(
        'bertta',
        flat.id,
        { ...kuusikuja, floorArea: 10 },
        now,
      ),
    ).toBe(false)
    expect(await repository.findForUser('anna', flat.id)).toEqual(flat)
  })

  test('counts the flats the user has access to', async () => {
    await repository.create('anna', kuusikuja, now)
    await repository.create('anna', kuusikuja, now)
    await repository.create('bertta', kuusikuja, now)

    expect(await repository.countForUser('anna')).toBe(2)
    expect(await repository.countForUser('bertta')).toBe(1)
  })
})
