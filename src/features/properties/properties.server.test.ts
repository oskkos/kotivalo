import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { createDb } from '#/server/platform/db.server'
import { createR2Storage } from '#/server/platform/storage.server'
import { createCaptureLogger } from '#/server/platform/logger.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import type { PropertyDetails } from './property'
import { propertyRepository } from './property.repository.server'
import {
  PROPERTY_LIMIT,
  archiveProperty,
  createProperty,
  deleteProperty,
  getProperty,
  getPropertyDeletion,
  listProperties,
  restoreProperty,
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
    storage: createR2Storage(env.FILES),
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
  await emptyTables(
    'ownership_periods',
    'property_access',
    'properties',
    'user',
  )
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

describe('The first ownership period', () => {
  const periods = async (id: string) =>
    (
      await env.DB.prepare(
        'SELECT user_id, share, valid_from, valid_to FROM ownership_periods WHERE property_id = ?',
      )
        .bind(id)
        .all()
    ).results

  test('Adding a flat records its owner from the given date', async () => {
    const result = await createProperty(
      depsFor('anna').deps,
      kuusikuja,
      '2022-06-12',
    )
    const id = result.ok ? result.id : ''

    expect(await periods(id)).toEqual([
      {
        user_id: 'anna',
        share: 10000,
        valid_from: '2022-06-12',
        valid_to: null,
      },
    ])
  })

  test('without a date the flat is owned from today in Finland', async () => {
    const result = await createProperty(depsFor('anna').deps, kuusikuja)
    const id = result.ok ? result.id : ''

    // `now` is 19 November 2026 at noon UTC.
    expect(await periods(id)).toEqual([
      expect.objectContaining({ valid_from: '2026-11-19' }),
    ])
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

    const { properties: flats } = await listProperties(depsFor('anna').deps)
    expect(flats.map((p) => p.streetAddress)).toEqual([
      'Koivupolku 7 A 4',
      'Rantatie 15 C 21',
    ])
  })
})

describe('Flats are shown only to users with access', () => {
  test("Another user's flat is not listed", async () => {
    await add('anna')

    expect(await listProperties(depsFor('bertta').deps)).toEqual({
      properties: [],
      archived: [],
    })
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
      await repository.create('anna', kuusikuja, now, '2022-06-12')
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

async function exec(sql: string, ...values: (string | number | null)[]) {
  await env.DB.prepare(sql)
    .bind(...values)
    .run()
}

/** Gives `userId` access to the flat as a member. */
async function addMember(propertyId: string, userId: string) {
  await exec(
    `INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, ?, 'member', 0)`,
    propertyId,
    userId,
  )
}

/** Makes `userId` a co-owner with `share` basis points, from the first period's start. */
async function addCoOwner(propertyId: string, userId: string, share: number) {
  await exec(
    `INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, ?, 'owner', 0)`,
    propertyId,
    userId,
  )
  await exec(
    `UPDATE ownership_periods SET share = ? WHERE property_id = ?`,
    10000 - share,
    propertyId,
  )
  await exec(
    `INSERT INTO ownership_periods (id, property_id, user_id, share, valid_from)
     VALUES (?, ?, ?, ?, '2022-06-12')`,
    crypto.randomUUID(),
    propertyId,
    userId,
    share,
  )
}

/** An expense with a receipt file in storage; returns the file's key. */
async function addReceipt(propertyId: string, userId: string) {
  const key = `receipts/${crypto.randomUUID()}`
  await env.FILES.put(key, new Uint8Array([37, 80, 68, 70]))
  const transactionId = crypto.randomUUID()
  await exec(
    `INSERT INTO transactions (id, property_id, type, category, amount, date, created_by, created_at, updated_at)
     VALUES (?, ?, 'expense', 'repair', 14550, '2026-03-01', ?, 0, 0)`,
    transactionId,
    propertyId,
    userId,
  )
  await exec(
    `INSERT INTO receipts (id, transaction_id, key, content_type, size, filename, uploaded_by, created_at)
     VALUES (?, ?, ?, 'application/pdf', 4, 'kuitti.pdf', ?, 0)`,
    crypto.randomUUID(),
    transactionId,
    key,
    userId,
  )
  return key
}

const inStorage = async (key: string) => (await env.FILES.head(key)) !== null

describe('Archiving a flat', () => {
  test("Archiving doesn't change a co-owner's list", async () => {
    const id = await add('anna')
    await addCoOwner(id, 'bertta', 5000)

    expect(await archiveProperty(depsFor('anna').deps, id)).toEqual({
      ok: true,
    })

    expect((await listProperties(depsFor('anna').deps)).properties).toEqual([])
    expect(
      (await listProperties(depsFor('bertta').deps)).properties,
    ).toHaveLength(1)
  })

  test('A member can archive', async () => {
    const id = await add('anna')
    await addMember(id, 'bertta')

    expect(await archiveProperty(depsFor('bertta').deps, id)).toEqual({
      ok: true,
    })

    const lists = await listProperties(depsFor('bertta').deps)
    expect(lists.properties).toEqual([])
    expect(lists.archived).toHaveLength(1)
    expect(await getProperty(depsFor('bertta').deps, id)).toMatchObject({
      ok: true,
    })
  })

  test('The archived day is the day in Finland, and the first day stays', async () => {
    const id = await add('anna')
    await archiveProperty(depsFor('anna').deps, id)
    const later = depsFor('anna').deps
    later.now = () => new Date(Date.UTC(2026, 11, 1, 12))
    await archiveProperty(later, id)

    const { archived } = await listProperties(depsFor('anna').deps)
    expect(archived[0]?.archivedOn).toBe('2026-11-19')
  })

  test('An archived flat still counts towards the limit', async () => {
    const repository = propertyRepository(db)
    const ids: string[] = []
    for (let i = 0; i < PROPERTY_LIMIT; i++) {
      ids.push(
        (await repository.create('anna', kuusikuja, now, '2022-06-12')).id,
      )
    }
    for (const id of ids.slice(0, 5)) {
      await archiveProperty(depsFor('anna').deps, id)
    }

    expect(await createProperty(depsFor('anna').deps, kuusikuja)).toEqual({
      ok: false,
      reason: 'property_limit_reached',
    })
  })

  test("Another user can't archive a flat", async () => {
    const id = await add('anna')

    expect(await archiveProperty(depsFor('bertta').deps, id)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
    expect(
      (await listProperties(depsFor('anna').deps)).properties,
    ).toHaveLength(1)
  })

  test('Restoring brings the flat back, and logs both', async () => {
    const id = await add('anna')
    const { deps, lines } = depsFor('anna')

    await archiveProperty(deps, id)
    expect(await restoreProperty(deps, id)).toEqual({ ok: true })

    expect((await listProperties(deps)).properties).toHaveLength(1)
    expect(lines).toContainEqual(
      expect.objectContaining({ event: 'property.archived', propertyId: id }),
    )
    expect(lines).toContainEqual(
      expect.objectContaining({ event: 'property.restored', propertyId: id }),
    )
    expect(await restoreProperty(depsFor('bertta').deps, id)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })
})

describe('Deleting a flat', () => {
  test('Deleting removes the flat and its receipt files', async () => {
    const id = await add('anna')
    const key = await addReceipt(id, 'anna')
    const { deps, lines } = depsFor('anna')

    expect(await deleteProperty(deps, id)).toEqual({ ok: true })

    expect(await getProperty(deps, id)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
    expect(await inStorage(key)).toBe(false)
    expect(lines).toContainEqual(
      expect.objectContaining({
        level: 'info',
        event: 'property.deleted',
        propertyId: id,
      }),
    )
  })

  test('A member loses access when the flat is deleted', async () => {
    const id = await add('anna')
    await addMember(id, 'bertta')

    await deleteProperty(depsFor('anna').deps, id)

    expect(await listProperties(depsFor('bertta').deps)).toEqual({
      properties: [],
      archived: [],
    })
    expect(await getProperty(depsFor('bertta').deps, id)).toMatchObject({
      ok: false,
    })
  })

  test('A pending invitation goes with the flat', async () => {
    const id = await add('anna')
    await exec(
      `INSERT INTO property_invitations (id, property_id, email, invited_by, created_at, expires_at)
       VALUES ('inv', ?, 'liisa@example.com', 'anna', 0, 9999999999999)`,
      id,
    )

    await deleteProperty(depsFor('anna').deps, id)

    const { results } = await env.DB.prepare(
      'SELECT 1 FROM property_invitations',
    ).all()
    expect(results).toEqual([])
  })

  test("A co-owned flat can't be deleted", async () => {
    const id = await add('anna')
    await addCoOwner(id, 'bertta', 5000)
    await exec(`UPDATE user SET name = 'Jussi' WHERE id = 'bertta'`)
    const key = await addReceipt(id, 'anna')
    const { deps, lines } = depsFor('anna')

    expect(await getPropertyDeletion(deps, id)).toEqual({
      ok: true,
      allowed: false,
      reason: 'property_delete_other_owners',
      otherOwners: ['Jussi'],
    })
    expect(await deleteProperty(deps, id)).toEqual({
      ok: false,
      reason: 'property_delete_other_owners',
    })

    expect(await getProperty(deps, id)).toMatchObject({ ok: true })
    expect(await inStorage(key)).toBe(true)
    expect(lines).toContainEqual(
      expect.objectContaining({
        level: 'warn',
        event: 'property.delete_refused',
        reason: 'property_delete_other_owners',
      }),
    )
  })

  test("A former owner's share prevents deleting", async () => {
    const id = await add('anna')
    await exec(`UPDATE user SET name = 'Jussi' WHERE id = 'bertta'`)
    await exec(
      `INSERT INTO ownership_periods (id, property_id, user_id, share, valid_from, valid_to)
       VALUES ('old', ?, 'bertta', 5000, '2025-03-01', '2025-12-31')`,
      id,
    )

    expect(await deleteProperty(depsFor('anna').deps, id)).toEqual({
      ok: false,
      reason: 'property_delete_other_owners',
    })
    expect(await getPropertyDeletion(depsFor('anna').deps, id)).toMatchObject({
      allowed: false,
      otherOwners: ['Jussi'],
    })
  })

  test("A member can't delete a flat", async () => {
    const id = await add('anna')
    await addMember(id, 'bertta')

    expect(await deleteProperty(depsFor('bertta').deps, id)).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect(await getProperty(depsFor('anna').deps, id)).toMatchObject({
      ok: true,
    })
  })

  test("Another user can't delete a flat", async () => {
    const id = await add('anna')

    expect(await deleteProperty(depsFor('bertta').deps, id)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
    expect(await getPropertyDeletion(depsFor('bertta').deps, id)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
    expect(await getProperty(depsFor('anna').deps, id)).toMatchObject({
      ok: true,
    })
  })

  test('Other flats are kept', async () => {
    const id = await add('anna')
    const other = await add('anna', {
      ...kuusikuja,
      streetAddress: 'Koivupolku 7 A 4',
    })
    const gone = await addReceipt(id, 'anna')
    const kept = await addReceipt(other, 'anna')

    await deleteProperty(depsFor('anna').deps, id)

    expect(await inStorage(gone)).toBe(false)
    expect(await inStorage(kept)).toBe(true)
    expect(await getProperty(depsFor('anna').deps, other)).toMatchObject({
      ok: true,
    })
    const { results } = await env.DB.prepare('SELECT key FROM receipts').all()
    expect(results).toEqual([{ key: kept }])
  })

  test('A failed file delete is logged and the flat is still deleted', async () => {
    const id = await add('anna')
    await addReceipt(id, 'anna')
    const { deps, lines } = depsFor('anna')
    deps.storage = {
      ...deps.storage,
      deleteMany: () => Promise.reject(new Error('R2 is down')),
    }

    expect(await deleteProperty(deps, id)).toEqual({ ok: true })

    expect(await getProperty(deps, id)).toMatchObject({ ok: false })
    expect(lines).toContainEqual(
      expect.objectContaining({
        level: 'error',
        event: 'property.receipt_delete_failed',
        count: 1,
      }),
    )
    expect(lines).toContainEqual(
      expect.objectContaining({ event: 'property.deleted' }),
    )
  })

  test('An ownership change after the check is caught by the guarded delete', async () => {
    const id = await add('anna')
    const { deps } = depsFor('anna')
    // The check passes, then Bertta gets a share before the delete runs.
    const repository = deps.properties
    deps.properties = {
      ...repository,
      receiptKeys: async (propertyId) => {
        await addCoOwner(id, 'bertta', 5000)
        return repository.receiptKeys(propertyId)
      },
    }

    expect(await deleteProperty(deps, id)).toEqual({
      ok: false,
      reason: 'property_delete_other_owners',
    })
    expect(await getProperty(depsFor('anna').deps, id)).toMatchObject({
      ok: true,
    })
  })

  test('The log lines carry ids, not names or addresses', async () => {
    const id = await add('anna')
    const { deps, lines } = depsFor('anna')

    await deleteProperty(deps, id)

    expect(JSON.stringify(lines)).not.toContain('Kuusikuja')
  })
})

describe('Confirming the deletion of a flat', () => {
  test('An empty flat has no data to lose', async () => {
    const id = await add('anna')

    expect(await getPropertyDeletion(depsFor('anna').deps, id)).toEqual({
      ok: true,
      allowed: true,
      hasData: false,
      counts: { tenancies: 0, rentPayments: 0, transactions: 0, receipts: 0 },
      members: [],
    })
  })

  test('The confirmation lists what is removed', async () => {
    const id = await add('anna')
    await addReceipt(id, 'anna')
    await exec(`UPDATE user SET name = 'Jussi' WHERE id = 'bertta'`)
    await addMember(id, 'bertta')

    expect(await getPropertyDeletion(depsFor('anna').deps, id)).toMatchObject({
      allowed: true,
      hasData: true,
      counts: { transactions: 1, receipts: 1 },
      members: ['Jussi'],
    })
  })
})
