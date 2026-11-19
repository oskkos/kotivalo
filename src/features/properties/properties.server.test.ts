import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { createDb } from '#/server/platform/db.server'
import { createCaptureLogger } from '#/server/platform/logger.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import type { PropertyDetails } from './property'
import { propertyRepository } from './property.repository.server'
import {
  PROPERTY_LIMIT,
  createProperty,
  getProperty,
  listProperties,
  updateProperty,
  type PropertyDeps,
} from './properties.server'

const db = createDb(env.DB)
const now = new Date(Date.UTC(2026, 10, 19, 12, 0, 0))

const kuusikuja: PropertyDetails = {
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2,
  floorArea: 485,
}

function depsFor(userId: string) {
  const { log, lines } = createCaptureLogger()
  const deps: PropertyDeps = {
    userId,
    properties: propertyRepository(db),
    log,
    now: () => now,
    collation: 'fi-FI',
  }
  return { deps, lines }
}

/** Adds a flat as the user and returns its id. */
async function add(userId: string, details: PropertyDetails = kuusikuja) {
  const result = await createProperty(depsFor(userId).deps, details)
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result.id
}

beforeEach(async () => {
  await emptyTables('property_access', 'properties', 'user')
  await addTestUser('anna')
  await addTestUser('bertta')
})

describe('Adding a flat', () => {
  test('The user who adds a flat gets access as an owner', async () => {
    const id = await add('anna')

    const { results } = await env.DB.prepare(
      'SELECT user_id, role FROM property_access WHERE property_id = ?',
    )
      .bind(id)
      .all()
    expect(results).toEqual([{ user_id: 'anna', role: 'owner' }])
  })

  test('logs the new flat by its id, without the address', async () => {
    const { deps, lines } = depsFor('anna')
    const result = await createProperty(deps, kuusikuja)

    expect(lines).toEqual([
      expect.objectContaining({
        level: 'info',
        event: 'property.created',
        propertyId: result.ok ? result.id : '',
      }),
    ])
    expect(JSON.stringify(lines)).not.toContain('Kuusikuja')
  })
})

describe('Editing a flat', () => {
  test('changes the details and logs the flat by its id', async () => {
    const id = await add('anna')
    const { deps, lines } = depsFor('anna')

    expect(
      await updateProperty(deps, id, { ...kuusikuja, floorArea: 490 }),
    ).toEqual({ ok: true, id })
    expect(await getProperty(deps, id)).toEqual({
      ok: true,
      property: { id, ...kuusikuja, floorArea: 490 },
    })
    expect(lines).toEqual([
      expect.objectContaining({ event: 'property.updated', propertyId: id }),
    ])
  })
})

describe('Listing flats', () => {
  test('sorts the flats by street address', async () => {
    await add('anna', { ...kuusikuja, streetAddress: 'Rantatie 15 C 21' })
    await add('anna', { ...kuusikuja, streetAddress: 'Koivupolku 7 A 4' })

    const flats = await listProperties(depsFor('anna').deps)
    expect(flats.map((p) => p.streetAddress)).toEqual([
      'Koivupolku 7 A 4',
      'Rantatie 15 C 21',
    ])
  })
})

describe('Flats are shown only to users with access', () => {
  test("Another user's flat is not listed", async () => {
    await add('anna')

    expect(await listProperties(depsFor('bertta').deps)).toEqual([])
  })

  test("Another user's flat cannot be opened", async () => {
    const id = await add('anna')

    const asBertta = depsFor('bertta').deps
    expect(await getProperty(asBertta, id)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
    // The same answer as for a flat that doesn't exist.
    expect(await getProperty(asBertta, 'missing')).toEqual(
      await getProperty(asBertta, id),
    )
  })

  test("Another user's flat cannot be changed", async () => {
    const id = await add('anna')
    const { deps, lines } = depsFor('bertta')

    expect(
      await updateProperty(deps, id, { ...kuusikuja, floorArea: 10 }),
    ).toEqual({ ok: false, reason: 'property_not_found' })
    expect(await getProperty(depsFor('anna').deps, id)).toEqual({
      ok: true,
      property: { id, ...kuusikuja },
    })
    expect(lines).toEqual([])
  })
})

describe('Limiting the number of flats', () => {
  test('The 101st flat is refused', async () => {
    const repository = propertyRepository(db)
    for (let i = 0; i < PROPERTY_LIMIT; i++) {
      await repository.create('anna', kuusikuja, now)
    }
    const { deps, lines } = depsFor('anna')

    expect(await createProperty(deps, kuusikuja)).toEqual({
      ok: false,
      reason: 'property_limit_reached',
    })
    expect(await repository.countForUser('anna')).toBe(PROPERTY_LIMIT)
    expect(lines).toEqual([
      expect.objectContaining({
        level: 'warn',
        event: 'property.limit_reached',
      }),
    ])
  })
})
