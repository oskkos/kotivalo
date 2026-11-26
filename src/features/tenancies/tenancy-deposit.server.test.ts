import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { documentRepository } from '#/features/documents/document.repository.server'
import { depositReturnRepository } from '#/features/deposits/deposit-return.repository.server'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { createDb } from '#/server/platform/db.server'
import { createCaptureLogger } from '#/server/platform/logger.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import {
  cancelTenancyEnding,
  createTenancy,
  endTenancy,
  getTenancy,
  updateTenancy,
  type TenancyDeps,
} from './tenancies.server'
import {
  tenancyRepository,
  type TenancyFields,
} from './tenancy.repository.server'

const db = createDb(env.DB)
let now = new Date(Date.UTC(2026, 10, 22, 10, 0, 0))
let flat = ''

function deps(userId = 'annika'): TenancyDeps {
  return {
    userId,
    tenancies: tenancyRepository(db),
    depositReturns: depositReturnRepository(db),
    documents: documentRepository(db),
    properties: propertyRepository(db),
    ownership: ownershipRepository(db),
    sharing: sharingRepository(db),
    log: createCaptureLogger().log,
    now: () => now,
  }
}

const aino: TenancyFields = {
  tenantName: 'Aino Koski',
  tenantPhone: null,
  tenantEmail: null,
  contractType: 'open_ended',
  contractMade: '2025-02-12',
  validFrom: '2025-03-01',
  termEnd: null,
  dueDay: 5,
  deposit: 178000,
}

const mikko: TenancyFields = {
  ...aino,
  tenantName: 'Mikko Lehtinen',
  contractType: 'fixed_term',
  contractMade: '2026-11-20',
  validFrom: '2027-01-01',
  termEnd: '2027-12-31',
}

async function add(fields: TenancyFields) {
  const result = await createTenancy(deps(), flat, fields, 89000, 1)
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result.tenancyId
}

async function depositOf(id: string) {
  const result = await getTenancy(deps(), flat, id)
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result.tenancy.deposit
}

async function recordReturn(
  tenancyId: string,
  fields: { returnedOn: string; rentKept: number; damageKept: number },
) {
  const id = await depositReturnRepository(db).record(
    'annika',
    flat,
    tenancyId,
    { ...fields, note: null },
    [],
    now,
  )
  if (id === null) {
    throw new Error('the return was not recorded')
  }
  return id
}

beforeEach(async () => {
  now = new Date(Date.UTC(2026, 10, 22, 10, 0, 0))
  await emptyTables(
    'rent_payments',
    'deposit_returns',
    'tenancies',
    'ownership_periods',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('annika')
  await addTestUser('jussi')
  flat = (
    await propertyRepository(db).create(
      'annika',
      {
        streetAddress: 'Kuusikuja 3 B 12',
        postcode: '33100',
        city: 'Tampere',
        roomCount: 2,
        floorArea: 485,
      },
      now,
      '2025-03-01',
    )
  ).id
  await env.DB.prepare(
    "INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, 'jussi', 'member', ?)",
  )
    .bind(flat, now.getTime())
    .run()
})

describe("A tenancy's deposit", () => {
  test('Adding a tenant with a deposit', async () => {
    expect(await depositOf(await add(aino))).toBe(178000)
  })

  test('A tenancy without a deposit', async () => {
    expect(await depositOf(await add({ ...aino, deposit: null }))).toBeNull()
  })

  test('Correcting the deposit', async () => {
    const id = await add(aino)
    expect(
      await updateTenancy(deps(), flat, id, { ...aino, deposit: 170000 }),
    ).toEqual({ ok: true })
    expect(await depositOf(id)).toBe(170000)
    expect(
      await updateTenancy(deps(), flat, id, { ...aino, deposit: null }),
    ).toEqual({ ok: true })
    expect(await depositOf(id)).toBeNull()
  })

  test("A member can't set a deposit", async () => {
    const id = await add(aino)
    expect(
      await updateTenancy(deps('jussi'), flat, id, { ...aino, deposit: 1 }),
    ).toEqual({ ok: false, reason: 'sharing_owner_only' })
    expect(await createTenancy(deps('jussi'), flat, mikko, 89000, 1)).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect(await depositOf(id)).toBe(178000)
  })
})

describe('Correcting and deleting a deposit return', () => {
  test("The deposit can't go below the amounts kept", async () => {
    const id = await add(aino)
    await endTenancy(deps(), flat, id, {
      noticeGivenBy: 'tenant',
      noticeDate: '2026-11-22',
      lastDay: '2026-12-31',
    })
    now = new Date(Date.UTC(2027, 0, 15, 10, 0, 0))
    await recordReturn(id, {
      returnedOn: '2027-01-15',
      rentKept: 30000,
      damageKept: 20000,
    })
    const ended = { ...aino }
    for (const deposit of [40000, null]) {
      expect(
        await updateTenancy(deps(), flat, id, { ...ended, deposit }),
      ).toEqual({
        ok: false,
        reason: 'deposit_below_kept',
      })
    }
    expect(await depositOf(id)).toBe(178000)
    expect(
      await updateTenancy(deps(), flat, id, { ...ended, deposit: 50000 }),
    ).toEqual({ ok: true })
  })
})

describe('A deposit return stays inside its tenancy', () => {
  test('Cancelling the ending of a returned tenancy is refused', async () => {
    const id = await add(aino)
    await endTenancy(deps(), flat, id, {
      noticeGivenBy: 'tenant',
      noticeDate: '2026-11-22',
      lastDay: '2027-01-31',
    })
    now = new Date(Date.UTC(2027, 0, 31, 10, 0, 0))
    await recordReturn(id, {
      returnedOn: '2027-01-31',
      rentKept: 0,
      damageKept: 0,
    })
    expect(await cancelTenancyEnding(deps(), flat, id)).toEqual({
      ok: false,
      reason: 'tenancy_has_deposit_return',
    })
    const after = await getTenancy(deps(), flat, id)
    expect(after.ok && after.tenancy.validTo).toBe('2027-01-31')
    expect(await depositReturnRepository(db).forTenancy(id)).toBeDefined()
  })

  test("Moving a fixed term's end past the return is refused", async () => {
    const id = await add({
      ...mikko,
      validFrom: '2026-01-01',
      termEnd: '2027-12-31',
    })
    now = new Date(Date.UTC(2028, 0, 10, 10, 0, 0))
    await recordReturn(id, {
      returnedOn: '2028-01-10',
      rentKept: 0,
      damageKept: 0,
    })
    expect(
      await updateTenancy(deps(), flat, id, {
        ...mikko,
        validFrom: '2026-01-01',
        termEnd: '2028-01-31',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_has_deposit_return' })
    const after = await getTenancy(deps(), flat, id)
    expect(after.ok && after.tenancy.validTo).toBe('2027-12-31')
  })
})
