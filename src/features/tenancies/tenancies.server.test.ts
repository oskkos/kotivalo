import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { recurringAmountRepository } from '#/features/recurring-amounts/recurring-amount.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { createDb } from '#/server/platform/db.server'
import { createCaptureLogger } from '#/server/platform/logger.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import {
  cancelTenancyEnding,
  createTenancy,
  endTenancy,
  getNewTenancyOptions,
  getTenancies,
  getTenancy,
  listTenancyStatuses,
  updateTenancy,
  type TenancyDeps,
} from './tenancies.server'
import {
  tenancyRepository,
  type TenancyFields,
} from './tenancy.repository.server'

const db = createDb(env.DB)
// 22 November 2026 at noon in Finland, unless a test moves it.
let now = new Date(Date.UTC(2026, 10, 22, 10, 0, 0))
let flat = ''

let capture = createCaptureLogger()

function deps(userId = 'annika'): TenancyDeps {
  return {
    userId,
    tenancies: tenancyRepository(db),
    amounts: recurringAmountRepository(db),
    properties: propertyRepository(db),
    ownership: ownershipRepository(db),
    sharing: sharingRepository(db),
    log: capture.log,
    now: () => now,
  }
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

const fixedTerm = (validFrom: string, termEnd: string): TenancyFields => ({
  ...aino,
  tenantName: 'Mikko Lehtinen',
  tenantPhone: null,
  tenantEmail: null,
  contractType: 'fixed_term',
  contractMade: '2026-11-20',
  validFrom,
  termEnd,
})

const rents = async () =>
  (await recurringAmountRepository(db).forProperty(flat)).amounts.rent

async function setRent(amount: number, from: string) {
  await recurringAmountRepository(db).setAmount({
    propertyId: flat,
    actorId: 'annika',
    kind: 'rent',
    amount,
    from,
    latestStart: (await rents()).at(-1)?.validFrom ?? null,
  })
}

async function add(fields: TenancyFields, rent = 89000, userId = 'annika') {
  return createTenancy(deps(userId), flat, fields, rent)
}

async function addId(fields: TenancyFields, rent = 89000) {
  const result = await add(fields, rent)
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result.tenancyId
}

async function view(userId = 'annika') {
  const result = await getTenancies(deps(userId), flat)
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result
}

const tenantNotice = {
  noticeGivenBy: 'tenant' as const,
  noticeDate: '2026-11-22',
  lastDay: '2026-12-31',
}

beforeEach(async () => {
  now = new Date(Date.UTC(2026, 10, 22, 10, 0, 0))
  capture = createCaptureLogger()
  await emptyTables(
    'tenancies',
    'recurring_amounts',
    'financing_treatments',
    'ownership_periods',
    'property_invitations',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('annika')
  await addTestUser('jussi')
  await addTestUser('liisa')
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
  await setRent(89000, '2025-03-01')
})

describe('Adding a tenant', () => {
  test('Adding an open-ended tenancy', async () => {
    const id = await addId(aino)
    const seen = await view()
    expect(seen.tenancies).toEqual([
      expect.objectContaining({
        id,
        tenantName: 'Aino Koski',
        contractType: 'open_ended',
        contractMade: '2025-02-12',
        validFrom: '2025-03-01',
        validTo: null,
        dueDay: 5,
      }),
    ])
    expect(seen.rentToday).toBe(89000)
  })

  test('Adding a fixed-term tenancy', async () => {
    await addId(fixedTerm('2027-01-01', '2027-12-31'))
    expect((await view()).tenancies[0]).toMatchObject({
      contractType: 'fixed_term',
      validFrom: '2027-01-01',
      validTo: '2027-12-31',
      termEnd: '2027-12-31',
    })
  })

  test("A member can't add a tenant", async () => {
    expect(await add(aino, 89000, 'jussi')).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect((await view()).tenancies).toEqual([])
  })
})

describe('Tenancy dates and details', () => {
  test('A tenancy overlapping the previous one is refused', async () => {
    const id = await addId(aino)
    await endTenancy(deps(), flat, id, tenantNotice)
    expect(await add({ ...fixedTerm('2026-12-15', '2027-12-31') })).toEqual({
      ok: false,
      reason: 'tenancy_overlaps',
    })
    expect((await view()).tenancies).toHaveLength(1)
  })

  test('A new tenant can be added during the notice period', async () => {
    const id = await addId(aino)
    await endTenancy(deps(), flat, id, tenantNotice)
    expect((await add(fixedTerm('2027-01-01', '2027-12-31'))).ok).toBe(true)
    expect(
      (await view()).tenancies.map((t) => [t.validFrom, t.validTo]),
    ).toEqual([
      ['2027-01-01', '2027-12-31'],
      ['2025-03-01', '2026-12-31'],
    ])
  })

  test("A tenancy can't be added while one runs without an end", async () => {
    await addId(aino)
    expect(await add(fixedTerm('2030-01-01', '2030-12-31'))).toEqual({
      ok: false,
      reason: 'tenancy_overlaps',
    })
  })

  test('An earlier tenancy can be added afterwards', async () => {
    await addId({
      ...aino,
      validFrom: '2025-06-01',
      contractMade: '2025-05-20',
    })
    expect(
      (
        await add({
          ...fixedTerm('2025-03-01', '2025-05-31'),
          contractMade: '2025-02-20',
        })
      ).ok,
    ).toBe(true)
    expect((await view()).tenancies.map((t) => t.validFrom)).toEqual([
      '2025-06-01',
      '2025-03-01',
    ])
  })

  test('A tenancy before the ownership is refused', async () => {
    expect(
      await add({
        ...aino,
        validFrom: '2025-02-15',
        contractMade: '2025-02-01',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_start_before_ownership' })
  })

  test('Contract made in the future is refused', async () => {
    expect(
      await add({
        ...aino,
        validFrom: '2027-01-01',
        contractMade: '2026-11-30',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_contract_made_in_future' })
  })

  test('A fixed term ending before it starts is refused', async () => {
    expect(await add(fixedTerm('2027-01-01', '2026-12-31'))).toEqual({
      ok: false,
      reason: 'tenancy_end_before_start',
    })
  })
})

describe('The rent of a new tenancy', () => {
  test('A changed rent starts from the start month', async () => {
    expect((await add(fixedTerm('2027-01-15', '2027-12-31'), 91000)).ok).toBe(
      true,
    )
    expect(await rents()).toEqual([
      { validFrom: '2025-03-01', validTo: '2026-12-31', value: 89000 },
      { validFrom: '2027-01-01', validTo: null, value: 91000 },
    ])
    expect(capture.lines.map((line) => line.event)).toEqual([
      'tenancy.created',
      'recurring_amount.set',
    ])
  })

  test('A rent for an earlier month than the latest change is refused', async () => {
    await setRent(92000, '2027-03-01')
    expect(await add(fixedTerm('2027-01-01', '2027-12-31'), 91000)).toEqual({
      ok: false,
      reason: 'amount_date_too_early',
    })
    expect((await view()).tenancies).toEqual([])
    expect(await rents()).toHaveLength(2)
  })

  test('An unchanged rent leaves the periods alone', async () => {
    expect((await add(fixedTerm('2027-01-01', '2027-12-31'), 89000)).ok).toBe(
      true,
    )
    expect(await rents()).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 89000 },
    ])
  })
})

describe('Ending a tenancy', () => {
  test('The tenant gives notice', async () => {
    const id = await addId(aino)
    expect(await endTenancy(deps(), flat, id, tenantNotice)).toEqual({
      ok: true,
    })
    expect((await view()).tenancies[0]).toMatchObject({
      validTo: '2026-12-31',
      noticeGivenBy: 'tenant',
      noticeDate: '2026-11-22',
    })
  })

  test("The landlord's notice can't be shorter than the law allows", async () => {
    const id = await addId(aino)
    expect(
      await endTenancy(deps(), flat, id, {
        noticeGivenBy: 'landlord',
        noticeDate: '2026-11-22',
        lastDay: '2027-03-31',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_end_before_notice_period' })
    expect((await view()).tenancies[0]?.validTo).toBeNull()
  })

  test("A member can't end a tenancy", async () => {
    const id = await addId(aino)
    expect(await endTenancy(deps('jussi'), flat, id, tenantNotice)).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect((await view()).tenancies[0]?.validTo).toBeNull()
  })
})

describe('ending a tenancy', () => {
  test('a tenancy already ended is refused', async () => {
    const id = await addId(aino)
    await endTenancy(deps(), flat, id, tenantNotice)
    expect(await endTenancy(deps(), flat, id, tenantNotice)).toEqual({
      ok: false,
      reason: 'tenancy_already_ending',
    })
  })

  test("another flat's tenancy is not found", async () => {
    const id = await addId(aino)
    const other = (
      await propertyRepository(db).create(
        'annika',
        {
          streetAddress: 'Koivupolku 7 A 4',
          postcode: '33100',
          city: 'Tampere',
          roomCount: 1,
          floorArea: 320,
        },
        now,
        '2025-03-01',
      )
    ).id
    expect(await endTenancy(deps(), other, id, tenantNotice)).toEqual({
      ok: false,
      reason: 'tenancy_not_found',
    })
  })
})

describe('Ending a fixed-term tenancy early', () => {
  test('Ending a fixed term by agreement', async () => {
    now = new Date(Date.UTC(2027, 4, 20, 10, 0, 0))
    const id = await addId(fixedTerm('2027-01-01', '2027-12-31'))
    expect(
      await endTenancy(deps(), flat, id, {
        noticeGivenBy: 'agreed',
        noticeDate: '2027-05-15',
        lastDay: '2027-06-30',
      }),
    ).toEqual({ ok: true })
    expect((await view()).tenancies[0]?.validTo).toBe('2027-06-30')
  })
})

describe('Cancelling an ending', () => {
  test("Cancelling the tenant's notice", async () => {
    const id = await addId(aino)
    await endTenancy(deps(), flat, id, tenantNotice)
    now = new Date(Date.UTC(2026, 10, 25, 10, 0, 0))
    expect(await cancelTenancyEnding(deps(), flat, id)).toEqual({ ok: true })
    expect((await view()).tenancies[0]).toMatchObject({
      validTo: null,
      noticeGivenBy: null,
      noticeDate: null,
    })
  })

  test('Cancelling after the last rent day is refused', async () => {
    const id = await addId(aino)
    await endTenancy(deps(), flat, id, tenantNotice)
    now = new Date(Date.UTC(2027, 0, 2, 10, 0, 0))
    expect(await cancelTenancyEnding(deps(), flat, id)).toEqual({
      ok: false,
      reason: 'tenancy_already_ended',
    })
  })

  test('Cancelling is refused when a new tenancy follows', async () => {
    const id = await addId(aino)
    await endTenancy(deps(), flat, id, tenantNotice)
    await addId(fixedTerm('2027-01-01', '2027-12-31'))
    expect(await cancelTenancyEnding(deps(), flat, id)).toEqual({
      ok: false,
      reason: 'tenancy_cancel_later_tenancy',
    })
  })
})

describe('cancelling an ending', () => {
  test('a tenancy that has not been ended is refused', async () => {
    const id = await addId(aino)
    expect(await cancelTenancyEnding(deps(), flat, id)).toEqual({
      ok: false,
      reason: 'tenancy_not_ending',
    })
  })
})

describe('Correcting a tenancy', () => {
  test("Correcting the tenant's phone number", async () => {
    const id = await addId(aino)
    expect(
      await updateTenancy(deps(), flat, id, {
        ...aino,
        tenantPhone: '040 765 4321',
      }),
    ).toEqual({ ok: true })
    expect((await view()).tenancies[0]?.tenantPhone).toBe('040 765 4321')
  })

  test("A correction can't make tenancies overlap", async () => {
    await addId({
      ...fixedTerm('2025-03-01', '2025-05-31'),
      contractMade: '2025-02-20',
    })
    const later = {
      ...aino,
      validFrom: '2025-06-01',
      contractMade: '2025-05-20',
    }
    const id = await addId(later)
    expect(
      await updateTenancy(deps(), flat, id, {
        ...later,
        validFrom: '2025-05-15',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_overlaps' })
    expect((await view()).tenancies.find((t) => t.id === id)?.validFrom).toBe(
      '2025-06-01',
    )
  })

  test("A member can't correct a tenancy", async () => {
    const id = await addId(aino)
    expect(
      await updateTenancy(deps('jussi'), flat, id, {
        ...aino,
        tenantPhone: '040 765 4321',
      }),
    ).toEqual({ ok: false, reason: 'sharing_owner_only' })
  })
})

describe('correcting a tenancy', () => {
  test('a correction keeps a recorded ending', async () => {
    const id = await addId(aino)
    await endTenancy(deps(), flat, id, tenantNotice)
    await updateTenancy(deps(), flat, id, { ...aino, tenantName: 'Aino Kivi' })
    expect((await view()).tenancies[0]).toMatchObject({
      tenantName: 'Aino Kivi',
      validTo: '2026-12-31',
      noticeGivenBy: 'tenant',
    })
  })
})

describe('reading tenancies', () => {
  test('members see the tenancies, users without access do not', async () => {
    await addId(aino)
    expect((await view('jussi')).tenancies).toHaveLength(1)
    expect(await getTenancies(deps('liisa'), flat)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })

  test('the new tenant options carry the rents and the ownership start', async () => {
    const options = await getNewTenancyOptions(deps(), flat)
    expect(options).toMatchObject({
      ok: true,
      ownershipStart: '2025-03-01',
      today: '2026-11-22',
      rents: [{ validFrom: '2025-03-01', validTo: null, value: 89000 }],
    })
  })

  test("one tenancy comes with the flat's others", async () => {
    const first = await addId({
      ...fixedTerm('2025-03-01', '2025-05-31'),
      contractMade: '2025-02-20',
    })
    const second = await addId({
      ...aino,
      validFrom: '2025-06-01',
      contractMade: '2025-05-20',
    })
    const result = await getTenancy(deps(), flat, second)
    expect(result.ok && result.others.map((t) => t.id)).toEqual([first])
    expect(await getTenancy(deps(), flat, 'missing')).toEqual({
      ok: false,
      reason: 'tenancy_not_found',
    })
  })
})

describe('tenancy logging', () => {
  test("each change is logged with ids and never the tenant's details", async () => {
    const id = await addId(aino)
    await updateTenancy(deps(), flat, id, {
      ...aino,
      tenantPhone: '040 765 4321',
    })
    await endTenancy(deps(), flat, id, tenantNotice)
    await cancelTenancyEnding(deps(), flat, id)
    expect(capture.lines.map((line) => line.event)).toEqual([
      'tenancy.created',
      'tenancy.updated',
      'tenancy.ended',
      'tenancy.ending_cancelled',
    ])
    expect(capture.lines[2]).toMatchObject({
      tenancyId: id,
      noticeGivenBy: 'tenant',
    })
    const text = JSON.stringify(capture.lines)
    for (const secret of ['Aino', 'Koski', '040', 'aino@example.com']) {
      expect(text).not.toContain(secret)
    }
  })
})

describe('tenancy statuses on the flats list', () => {
  test('each flat of the user gets its status', async () => {
    const id = await addId(aino)
    await endTenancy(deps(), flat, id, tenantNotice)
    const other = (
      await propertyRepository(db).create(
        'annika',
        {
          streetAddress: 'Koivupolku 7 A 4',
          postcode: '33100',
          city: 'Tampere',
          roomCount: 1,
          floorArea: 320,
        },
        now,
        '2025-03-01',
      )
    ).id
    expect(await listTenancyStatuses(deps())).toEqual({
      [flat]: {
        kind: 'notice_given',
        tenantName: 'Aino Koski',
        on: '2026-12-31',
      },
      [other]: { kind: 'vacant', nextStart: null },
    })
    expect(await listTenancyStatuses(deps('liisa'))).toEqual({})
  })
})
