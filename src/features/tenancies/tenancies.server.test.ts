import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { rentPaymentRepository } from '#/features/rent-payments/rent-payment.repository.server'
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
  removeTenancy,
  setTenancyRent,
  undoTenancyRent,
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

const tenancyRents = async (id: string) =>
  (await tenancyRepository(db).rentsFor([id]))[id] ?? []

async function add(
  fields: TenancyFields,
  rent = 89000,
  userId = 'annika',
  occupants = 1,
) {
  return createTenancy(deps(userId), flat, fields, rent, occupants)
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

/** Makes `flat` a flat owned since `since`. */
async function flatOwnedSince(since: string) {
  flat = (
    await propertyRepository(db).create(
      'annika',
      {
        streetAddress: 'Koivupolku 7 A 4',
        postcode: '33100',
        city: 'Tampere',
        roomCount: 1,
        floorArea: 310,
      },
      now,
      since,
    )
  ).id
}

const pekka: TenancyFields = {
  ...aino,
  tenantName: 'Pekka Virtanen',
  contractMade: '2023-05-15',
  validFrom: '2023-06-01',
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
    'rent_payments',
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
    expect(seen.rents[id]).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 89000 },
    ])
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

  test('Adding an earlier tenancy with its ending', async () => {
    await flatOwnedSince('2022-06-12')
    await addId(aino)
    expect(
      await createTenancy(deps(), flat, pekka, 82000, 1, {
        noticeGivenBy: 'tenant',
        noticeDate: '2025-01-20',
        lastDay: '2025-02-28',
      }),
    ).toMatchObject({ ok: true })
    expect((await view()).tenancies[1]).toMatchObject({
      tenantName: 'Pekka Virtanen',
      validTo: '2025-02-28',
      noticeGivenBy: 'tenant',
      noticeDate: '2025-01-20',
    })
  })

  test('The ending of an earlier tenancy follows the notice rules', async () => {
    await flatOwnedSince('2022-06-12')
    // Made before 2026-10-01 and over a year on the notice date: 6 months.
    expect(
      await createTenancy(deps(), flat, pekka, 82000, 1, {
        noticeGivenBy: 'landlord',
        noticeDate: '2025-01-10',
        lastDay: '2025-02-28',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_end_before_notice_period' })
    expect((await view()).tenancies).toEqual([])
  })

  test("The ending can't be recorded for a tenancy that hasn't started", async () => {
    expect(
      await createTenancy(
        deps(),
        flat,
        fixedTerm('2027-01-01', '2027-12-31'),
        89000,
        1,
        {
          noticeGivenBy: 'agreed',
          noticeDate: '2026-11-20',
          lastDay: '2026-12-31',
        },
      ),
    ).toEqual({ ok: false, reason: 'tenancy_notice_before_start' })
    expect((await view()).tenancies).toEqual([])
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

  test('An earlier open-ended tenancy without its ending is refused', async () => {
    await flatOwnedSince('2022-06-12')
    await addId(aino)
    expect(await createTenancy(deps(), flat, pekka, 82000, 1)).toEqual({
      ok: false,
      reason: 'tenancy_overlaps',
    })
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
  test("The rent starts on the tenancy's start day", async () => {
    const id = await addId(fixedTerm('2027-01-15', '2027-12-31'), 91000)
    expect(await tenancyRents(id)).toEqual([
      { validFrom: '2027-01-15', validTo: null, value: 91000 },
    ])
  })

  test('An earlier tenancy gets its own rent', async () => {
    await flatOwnedSince('2022-06-12')
    const ainoId = await addId(aino, 89000)
    const result = await createTenancy(deps(), flat, pekka, 82000, 1, {
      noticeGivenBy: 'tenant',
      noticeDate: '2025-01-20',
      lastDay: '2025-02-28',
    })
    if (!result.ok) {
      throw new Error(result.reason)
    }
    expect(await tenancyRents(result.tenancyId)).toEqual([
      { validFrom: '2023-06-01', validTo: null, value: 82000 },
    ])
    expect(await tenancyRents(ainoId)).toEqual([
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

describe("Removing a tenancy that hasn't started", () => {
  test('Removing a tenancy whose tenant withdrew', async () => {
    const id = await addId(fixedTerm('2027-01-01', '2027-12-31'), 91000)
    expect(await tenancyRents(id)).toHaveLength(1)
    expect(await removeTenancy(deps(), flat, id)).toEqual({ ok: true })
    expect((await view()).tenancies).toEqual([])
    expect(await tenancyRents(id)).toEqual([])
    expect(capture.lines.at(-1)).toMatchObject({
      event: 'tenancy.removed',
      tenancyId: id,
    })
  })

  test("A started tenancy can't be removed", async () => {
    const id = await addId(fixedTerm('2026-11-22', '2027-11-21'))
    expect(await removeTenancy(deps(), flat, id)).toEqual({
      ok: false,
      reason: 'tenancy_already_started',
    })
    expect((await view()).tenancies).toHaveLength(1)
  })

  test("A member can't remove a tenancy", async () => {
    const id = await addId(fixedTerm('2027-01-01', '2027-12-31'))
    expect(await removeTenancy(deps('jussi'), flat, id)).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect((await view()).tenancies).toHaveLength(1)
  })
})

describe('Cancelling an ending', () => {
  test("A later tenancy after the original term doesn't prevent cancelling", async () => {
    const id = await addId(fixedTerm('2027-01-01', '2027-12-31'))
    now = new Date(Date.UTC(2027, 5, 10, 10, 0, 0))
    expect(
      await endTenancy(deps(), flat, id, {
        noticeGivenBy: 'agreed',
        noticeDate: '2027-06-10',
        lastDay: '2027-06-30',
      }),
    ).toEqual({ ok: true })
    await addId({
      ...aino,
      contractMade: '2027-06-01',
      validFrom: '2028-02-01',
    })
    now = new Date(Date.UTC(2027, 5, 15, 10, 0, 0))
    expect(await cancelTenancyEnding(deps(), flat, id)).toEqual({ ok: true })
    expect((await view()).tenancies.find((t) => t.id === id)?.validTo).toBe(
      '2027-12-31',
    )
  })

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

  test('A correction must fit a recorded ending', async () => {
    const id = await addId(aino)
    await endTenancy(deps(), flat, id, tenantNotice)
    const refused = { ok: false, reason: 'tenancy_correction_conflicts_ending' }
    // A fixed term can't have the tenant's notice, nor end after its term.
    expect(
      await updateTenancy(deps(), flat, id, {
        ...aino,
        contractType: 'fixed_term',
        termEnd: '2026-11-30',
      }),
    ).toEqual(refused)
    // The notice can't come before the corrected start.
    expect(
      await updateTenancy(deps(), flat, id, {
        ...aino,
        contractMade: '2026-11-23',
        validFrom: '2026-11-23',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_contract_made_in_future' })
    now = new Date(Date.UTC(2026, 10, 25, 10, 0, 0))
    expect(
      await updateTenancy(deps(), flat, id, {
        ...aino,
        contractMade: '2026-11-23',
        validFrom: '2026-11-23',
      }),
    ).toEqual(refused)
    expect((await view()).tenancies[0]).toMatchObject({
      contractType: 'open_ended',
      validFrom: '2025-03-01',
      validTo: '2026-12-31',
    })
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

  test("a landlord's notice must keep its period after a correction", async () => {
    // A contract made after 2026-10-01, under two years: 3 months.
    const renewed = { ...aino, contractMade: '2026-10-15' }
    const id = await addId(renewed)
    await endTenancy(deps(), flat, id, {
      noticeGivenBy: 'landlord',
      noticeDate: '2026-11-22',
      lastDay: '2027-02-28',
    })
    // Made before 2026-10-01 and over a year: 6 months, so it no longer fits.
    expect(
      await updateTenancy(deps(), flat, id, {
        ...renewed,
        contractMade: '2025-02-12',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_correction_conflicts_ending' })
    expect(
      await updateTenancy(deps(), flat, id, {
        ...renewed,
        tenantName: 'Aino Kivi',
      }),
    ).toEqual({ ok: true })
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

  test("the new tenant options carry the tenancies' rents and the ownership start", async () => {
    const id = await addId(aino, 89000)
    const options = await getNewTenancyOptions(deps(), flat)
    expect(options).toMatchObject({
      ok: true,
      ownershipStart: '2025-03-01',
      today: '2026-11-22',
      tenancyRents: {
        [id]: [{ validFrom: '2025-03-01', validTo: null, value: 89000 }],
      },
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

/** Records a payment for `month`, paid before today (rent in advance). */
async function paid(tenancyId: string, month: string) {
  const id = await rentPaymentRepository(db).record(
    'annika',
    flat,
    { tenancyId, month, amount: 89000, paidOn: '2026-11-20' },
    now,
  )
  if (id === null) {
    throw new Error(`no payment for ${month}`)
  }
}

describe('Payments stay inside their tenancy', () => {
  test('Ending before a paid month is refused', async () => {
    const id = await addId(aino)
    await paid(id, '2027-01')
    expect(await endTenancy(deps(), flat, id, tenantNotice)).toEqual({
      ok: false,
      reason: 'tenancy_has_payments_outside',
    })
    expect((await view()).tenancies[0]?.validTo).toBe(null)
  })

  test('ending in the paid month is allowed', async () => {
    const id = await addId(aino)
    await paid(id, '2026-12')
    expect(await endTenancy(deps(), flat, id, tenantNotice)).toEqual({
      ok: true,
    })
  })

  test('Correcting the start past a paid month is refused', async () => {
    const id = await addId(aino)
    await paid(id, '2025-03')
    expect(
      await updateTenancy(deps(), flat, id, {
        ...aino,
        validFrom: '2025-04-01',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_has_payments_outside' })
    expect((await view()).tenancies[0]?.validFrom).toBe('2025-03-01')
  })

  test('Moving the start within the paid month is allowed', async () => {
    const id = await addId(aino)
    await paid(id, '2025-03')
    expect(
      await updateTenancy(deps(), flat, id, {
        ...aino,
        validFrom: '2025-03-15',
      }),
    ).toEqual({ ok: true })
    expect((await view()).tenancies[0]?.validFrom).toBe('2025-03-15')
  })

  test('correcting a fixed term to end before a paid month is refused', async () => {
    const id = await addId(fixedTerm('2026-01-01', '2026-12-31'))
    await paid(id, '2026-12')
    expect(
      await updateTenancy(deps(), flat, id, {
        ...fixedTerm('2026-01-01', '2026-11-30'),
      }),
    ).toEqual({ ok: false, reason: 'tenancy_has_payments_outside' })
  })

  test('Removing a tenancy with payments is refused', async () => {
    const id = await addId(fixedTerm('2027-01-01', '2027-12-31'))
    await paid(id, '2027-01')
    expect(await removeTenancy(deps(), flat, id)).toEqual({
      ok: false,
      reason: 'tenancy_has_payments',
    })
    expect((await view()).tenancies).toHaveLength(1)
  })

  test('the writes themselves keep payments inside', async () => {
    const repo = tenancyRepository(db)
    const id = await addId(aino)
    await paid(id, '2027-01')
    expect(await repo.end('annika', flat, id, tenantNotice, now)).toBe(false)
    expect(
      await repo.update(
        'annika',
        flat,
        id,
        { ...aino, validFrom: '2027-02-01' },
        { validTo: null, expectedValidTo: null },
        now,
      ),
    ).toBe(false)
  })

  test('the removing write itself keeps a tenancy with payments', async () => {
    const repo = tenancyRepository(db)
    const later = await addId(fixedTerm('2027-06-01', '2027-12-31'))
    await paid(later, '2027-06')
    expect(
      await repo.removeNotStarted('annika', flat, later, '2026-11-22'),
    ).toBe(false)
  })

  /** Deps whose first payment check misses a payment recorded right after. */
  function racing(tenancyId: string, month: string): TenancyDeps {
    const base = deps()
    let checked = false
    return {
      ...base,
      tenancies: {
        ...base.tenancies,
        paymentMonths: async (id) => {
          if (!checked) {
            checked = true
            await paid(tenancyId, month)
            return []
          }
          return base.tenancies.paymentMonths(id)
        },
      },
    }
  }

  test('a payment recorded during an ending is named as the reason', async () => {
    const id = await addId(aino)
    expect(
      await endTenancy(racing(id, '2027-01'), flat, id, tenantNotice),
    ).toEqual({ ok: false, reason: 'tenancy_has_payments_outside' })
  })

  test('a payment recorded during a correction is named as the reason', async () => {
    const id = await addId(aino)
    expect(
      await updateTenancy(racing(id, '2025-03'), flat, id, {
        ...aino,
        validFrom: '2025-04-01',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_has_payments_outside' })
  })

  test('a payment recorded during a removal is named as the reason', async () => {
    const id = await addId(fixedTerm('2027-01-01', '2027-12-31'))
    expect(await removeTenancy(racing(id, '2027-01'), flat, id)).toEqual({
      ok: false,
      reason: 'tenancy_has_payments',
    })
  })
})

describe('Rent changes stay inside their tenancy', () => {
  async function ainoWithChange(changeFrom: string) {
    const id = await addId(aino, 89000)
    await tenancyRepository(db).setRent({
      actorId: 'annika',
      propertyId: flat,
      tenancyId: id,
      amount: 92000,
      from: changeFrom,
      latestStart: '2025-03-01',
    })
    return id
  }

  test('Ending before a rent change is refused', async () => {
    const id = await ainoWithChange('2027-03-01')
    expect(
      await endTenancy(deps(), flat, id, {
        noticeGivenBy: 'tenant',
        noticeDate: '2026-11-22',
        lastDay: '2027-01-31',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_has_rent_after_end' })
    expect((await view()).tenancies[0]?.validTo).toBeNull()
    expect(await tenancyRents(id)).toHaveLength(2)
  })

  test('Ending after the latest rent change is allowed', async () => {
    const id = await ainoWithChange('2026-03-01')
    expect(await endTenancy(deps(), flat, id, tenantNotice)).toEqual({
      ok: true,
    })
    expect(await tenancyRents(id)).toEqual([
      { validFrom: '2025-03-01', validTo: '2026-02-28', value: 89000 },
      { validFrom: '2026-03-01', validTo: null, value: 92000 },
    ])
  })

  test('Moving the start moves the first rent', async () => {
    const id = await addId(aino, 89000)
    expect(
      await updateTenancy(deps(), flat, id, {
        ...aino,
        validFrom: '2025-03-15',
      }),
    ).toEqual({ ok: true })
    expect(await tenancyRents(id)).toEqual([
      { validFrom: '2025-03-15', validTo: null, value: 89000 },
    ])
  })

  test('A start after a rent change is refused', async () => {
    const id = await ainoWithChange('2026-03-01')
    expect(
      await updateTenancy(deps(), flat, id, {
        ...aino,
        validFrom: '2026-04-01',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_start_after_rent_change' })
    expect((await view()).tenancies[0]?.validFrom).toBe('2025-03-01')
    expect((await tenancyRents(id))[0]?.validFrom).toBe('2025-03-01')
  })

  test("a fixed term's end before a rent change is refused", async () => {
    const id = await addId(fixedTerm('2027-01-01', '2027-12-31'), 91000)
    await tenancyRepository(db).setRent({
      actorId: 'annika',
      propertyId: flat,
      tenancyId: id,
      amount: 93000,
      from: '2027-06-01',
      latestStart: '2027-01-01',
    })
    expect(
      await updateTenancy(
        deps(),
        flat,
        id,
        fixedTerm('2027-01-01', '2027-05-31'),
      ),
    ).toEqual({ ok: false, reason: 'tenancy_has_rent_after_end' })
  })
})

/** A tenant fee stored directly, until the fee writes exist. */
async function storeFee(
  tenancyId: string,
  id: string,
  kind: string,
  basis: string,
  ...amounts: [number, string, string | null][]
) {
  await env.DB.prepare(
    'INSERT INTO tenant_fees (id, tenancy_id, kind, basis) VALUES (?, ?, ?, ?)',
  )
    .bind(id, tenancyId, kind, basis)
    .run()
  for (const [amount, from, to] of amounts) {
    await env.DB.prepare(
      'INSERT INTO tenant_fee_amounts (id, tenant_fee_id, amount, valid_from, valid_to) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), id, amount, from, to)
      .run()
  }
}

async function storeOccupants(
  tenancyId: string,
  persons: number,
  from: string,
  to: string | null,
) {
  await env.DB.prepare(
    'INSERT INTO tenancy_occupants (id, tenancy_id, persons, valid_from, valid_to) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(crypto.randomUUID(), tenancyId, persons, from, to)
    .run()
}

const occupantsOf = async (id: string) =>
  (await tenancyRepository(db).occupantsFor([id]))[id] ?? []

const feesOf = async (id: string) =>
  (await tenancyRepository(db).feesFor([id]))[id] ?? []

describe('The occupants of a new tenancy', () => {
  test('The occupants of a new tenancy', async () => {
    const result = await add(
      fixedTerm('2027-01-15', '2027-12-31'),
      89000,
      'annika',
      2,
    )
    if (!result.ok) {
      throw new Error(result.reason)
    }
    expect(await occupantsOf(result.tenancyId)).toEqual([
      { validFrom: '2027-01-15', validTo: null, value: 2 },
    ])
  })

  test('an earlier tenancy gets its occupants from its own start', async () => {
    await flatOwnedSince('2022-06-12')
    await addId(aino)
    const result = await createTenancy(deps(), flat, pekka, 82000, 3, {
      noticeGivenBy: 'tenant',
      noticeDate: '2025-01-20',
      lastDay: '2025-02-28',
    })
    if (!result.ok) {
      throw new Error(result.reason)
    }
    expect(await occupantsOf(result.tenancyId)).toEqual([
      { validFrom: '2023-06-01', validTo: null, value: 3 },
    ])
  })

  test('a refused tenancy stores no occupants', async () => {
    await addId(aino)
    expect((await add(fixedTerm('2026-01-01', '2026-12-31'))).ok).toBe(false)
    const row = await env.DB.prepare(
      'SELECT count(*) AS n FROM tenancy_occupants',
    ).first<{ n: number }>()
    expect(row?.n).toBe(1)
  })
})

describe('Occupants and fees stay inside their tenancy', () => {
  test('Ending before a fee change is refused', async () => {
    const id = await addId(aino)
    await storeFee(
      id,
      'parking',
      'parking',
      'fixed',
      [1500, '2026-02-01', '2027-02-28'],
      [2000, '2027-03-01', null],
    )
    expect(
      await endTenancy(deps(), flat, id, {
        noticeGivenBy: 'tenant',
        noticeDate: '2026-11-22',
        lastDay: '2027-01-31',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_has_changes_after_end' })
    expect((await view()).tenancies[0]?.validTo).toBeNull()
    expect(await feesOf(id)).toHaveLength(1)
  })

  test('Ending before an occupants change is refused', async () => {
    const id = await addId(aino)
    await env.DB.prepare(
      'UPDATE tenancy_occupants SET valid_to = ? WHERE tenancy_id = ?',
    )
      .bind('2027-02-28', id)
      .run()
    await storeOccupants(id, 2, '2027-03-01', null)
    expect(
      await endTenancy(deps(), flat, id, {
        noticeGivenBy: 'tenant',
        noticeDate: '2026-11-22',
        lastDay: '2027-01-31',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_has_changes_after_end' })
    expect(await occupantsOf(id)).toHaveLength(2)
  })

  test('Ending after the latest changes is allowed', async () => {
    const id = await addId(aino)
    await storeFee(id, 'parking', 'parking', 'fixed', [
      1500,
      '2026-02-01',
      null,
    ])
    expect(await endTenancy(deps(), flat, id, tenantNotice)).toEqual({
      ok: true,
    })
  })

  test("a fixed term's end before a fee change is refused", async () => {
    const id = await addId(fixedTerm('2027-01-01', '2027-12-31'))
    await storeFee(id, 'parking', 'parking', 'fixed', [
      1500,
      '2027-06-01',
      null,
    ])
    expect(
      await updateTenancy(
        deps(),
        flat,
        id,
        fixedTerm('2027-01-01', '2027-05-31'),
      ),
    ).toEqual({ ok: false, reason: 'tenancy_has_changes_after_end' })
  })

  test('Moving the start moves the first occupants and fees', async () => {
    const id = await addId(aino)
    await storeFee(id, 'water', 'water', 'per_occupant', [
      2200,
      '2025-03-01',
      null,
    ])
    await storeFee(id, 'parking', 'parking', 'fixed', [
      1500,
      '2026-02-01',
      null,
    ])
    expect(
      await updateTenancy(deps(), flat, id, {
        ...aino,
        validFrom: '2025-03-15',
      }),
    ).toEqual({ ok: true })
    expect(await occupantsOf(id)).toEqual([
      { validFrom: '2025-03-15', validTo: null, value: 1 },
    ])
    const fees = await feesOf(id)
    expect(fees.find((f) => f.id === 'water')?.amounts[0]?.validFrom).toBe(
      '2025-03-15',
    )
    expect(fees.find((f) => f.id === 'parking')?.amounts[0]?.validFrom).toBe(
      '2026-02-01',
    )
  })

  test('A start after an occupants change is refused', async () => {
    const id = await addId(aino)
    await env.DB.prepare(
      'UPDATE tenancy_occupants SET valid_to = ? WHERE tenancy_id = ?',
    )
      .bind('2026-08-31', id)
      .run()
    await storeOccupants(id, 2, '2026-09-01', null)
    expect(
      await updateTenancy(deps(), flat, id, {
        ...aino,
        validFrom: '2026-10-01',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_start_after_change' })
    expect((await view()).tenancies[0]?.validFrom).toBe('2025-03-01')
    expect((await occupantsOf(id))[0]?.validFrom).toBe('2025-03-01')
  })

  test('a start after a fee change is refused', async () => {
    const id = await addId(aino)
    await storeFee(
      id,
      'parking',
      'parking',
      'fixed',
      [1500, '2025-03-01', '2026-08-31'],
      [2000, '2026-09-01', null],
    )
    expect(
      await updateTenancy(deps(), flat, id, {
        ...aino,
        validFrom: '2026-10-01',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_start_after_change' })
  })

  test('Removing a tenancy removes its fees', async () => {
    const id = await addId(fixedTerm('2027-01-01', '2027-12-31'))
    await storeFee(id, 'parking', 'parking', 'fixed', [
      1500,
      '2027-01-01',
      null,
    ])
    expect(await removeTenancy(deps(), flat, id)).toEqual({ ok: true })
    expect(await feesOf(id)).toEqual([])
    expect(await occupantsOf(id)).toEqual([])
    const rows = await env.DB.prepare(
      'SELECT (SELECT count(*) FROM tenant_fee_amounts) AS amounts',
    ).first<{ amounts: number }>()
    expect(rows?.amounts).toBe(0)
  })
})

describe("Changing a tenancy's rent", () => {
  test('Raising the rent from March', async () => {
    const id = await addId(aino, 89000)
    expect(
      await setTenancyRent(deps(), flat, id, {
        amount: 92000,
        from: '2027-03-01',
      }),
    ).toEqual({ ok: true })
    expect(await tenancyRents(id)).toEqual([
      { validFrom: '2025-03-01', validTo: '2027-02-28', value: 89000 },
      { validFrom: '2027-03-01', validTo: null, value: 92000 },
    ])
    expect(capture.lines.at(-1)).toMatchObject({
      event: 'tenancy.rent_changed',
      propertyId: flat,
      tenancyId: id,
    })
    expect(JSON.stringify(capture.lines.at(-1))).not.toContain('92000')
  })

  test("Correcting the first rent on the tenancy's start", async () => {
    const id = await addId(fixedTerm('2026-11-15', '2027-11-14'), 90000)
    expect(
      await setTenancyRent(deps(), flat, id, {
        amount: 95000,
        from: '2026-11-15',
      }),
    ).toEqual({ ok: true })
    expect(await tenancyRents(id)).toEqual([
      { validFrom: '2026-11-15', validTo: null, value: 95000 },
    ])
    expect(capture.lines.at(-1)?.event).toBe('tenancy.rent_corrected')
  })

  test('A mid-month date other than the start is refused', async () => {
    const id = await addId(aino)
    expect(
      await setTenancyRent(deps(), flat, id, {
        amount: 92000,
        from: '2027-03-15',
      }),
    ).toEqual({ ok: false, reason: 'amount_date_not_month_start' })
  })

  test('A date before the tenancy is refused', async () => {
    const id = await addId(aino)
    expect(
      await setTenancyRent(deps(), flat, id, {
        amount: 92000,
        from: '2025-01-01',
      }),
    ).toEqual({ ok: false, reason: 'rent_date_before_tenancy' })
  })

  test('A date after the tenancy is refused', async () => {
    const id = await addId(fixedTerm('2026-02-01', '2027-01-31'))
    expect(
      await setTenancyRent(deps(), flat, id, {
        amount: 92000,
        from: '2027-02-01',
      }),
    ).toEqual({ ok: false, reason: 'rent_date_after_tenancy' })
    expect(await tenancyRents(id)).toHaveLength(1)
  })

  test('A rent date before the latest change is refused', async () => {
    const id = await addId(aino)
    await setTenancyRent(deps(), flat, id, {
      amount: 89000,
      from: '2026-03-01',
    })
    expect(
      await setTenancyRent(deps(), flat, id, {
        amount: 92000,
        from: '2025-06-01',
      }),
    ).toEqual({ ok: false, reason: 'amount_date_too_early' })
  })

  test('Filling the first months of a migrated tenancy', async () => {
    const id = await addId(aino, 89000)
    // As the migration leaves it: the flat's rent was set after the start.
    await env.DB.prepare(
      "UPDATE tenancy_rents SET valid_from = '2026-01-01' WHERE tenancy_id = ?",
    )
      .bind(id)
      .run()
    expect(
      await setTenancyRent(deps(), flat, id, {
        amount: 85000,
        from: '2025-03-01',
      }),
    ).toEqual({ ok: true })
    expect(await tenancyRents(id)).toEqual([
      { validFrom: '2025-03-01', validTo: '2025-12-31', value: 85000 },
      { validFrom: '2026-01-01', validTo: null, value: 89000 },
    ])
    expect(capture.lines.at(-1)).toMatchObject({
      event: 'tenancy.rent_changed',
      tenancyId: id,
    })
    expect(
      await setTenancyRent(deps(), flat, id, {
        amount: 86000,
        from: '2025-06-01',
      }),
    ).toEqual({ ok: false, reason: 'amount_date_too_early' })
  })

  test('Correcting an earlier rent period', async () => {
    const id = await addId(aino, 85000)
    await setTenancyRent(deps(), flat, id, {
      amount: 89000,
      from: '2026-01-01',
    })
    expect(
      await setTenancyRent(deps(), flat, id, {
        amount: 80000,
        from: '2025-03-01',
      }),
    ).toEqual({ ok: true })
    expect(await tenancyRents(id)).toEqual([
      { validFrom: '2025-03-01', validTo: '2025-12-31', value: 80000 },
      { validFrom: '2026-01-01', validTo: null, value: 89000 },
    ])
    expect(capture.lines.at(-1)).toMatchObject({
      event: 'tenancy.rent_corrected',
      tenancyId: id,
    })
  })

  test("Another flat's tenancy is not found", async () => {
    const id = await addId(aino)
    const second = (
      await propertyRepository(db).create(
        'annika',
        {
          streetAddress: 'Koivupolku 7 A 4',
          postcode: '33100',
          city: 'Tampere',
          roomCount: 1,
          floorArea: 310,
        },
        now,
        '2025-03-01',
      )
    ).id
    expect(
      await setTenancyRent(deps(), second, id, {
        amount: 92000,
        from: '2027-03-01',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_not_found' })
    expect(await tenancyRents(id)).toHaveLength(1)
  })

  test("A member can't change the rent", async () => {
    const id = await addId(aino)
    expect(
      await setTenancyRent(deps('jussi'), flat, id, {
        amount: 92000,
        from: '2027-03-01',
      }),
    ).toEqual({ ok: false, reason: 'sharing_owner_only' })
    expect(await tenancyRents(id)).toHaveLength(1)
  })
})

describe("Undoing a tenancy's rent change", () => {
  async function withIncrease() {
    const id = await addId(aino, 89000)
    await setTenancyRent(deps(), flat, id, {
      amount: 92000,
      from: '2027-03-01',
    })
    return id
  }

  test('Undoing a rent increase', async () => {
    const id = await withIncrease()
    expect(await undoTenancyRent(deps(), flat, id)).toEqual({ ok: true })
    expect(await tenancyRents(id)).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 89000 },
    ])
    expect(capture.lines.at(-1)).toMatchObject({
      event: 'tenancy.rent_change_undone',
      tenancyId: id,
    })
  })

  test("The first rent can't be undone", async () => {
    const id = await addId(aino)
    expect(await undoTenancyRent(deps(), flat, id)).toEqual({
      ok: false,
      reason: 'amount_nothing_to_undo',
    })
    expect(await tenancyRents(id)).toHaveLength(1)
  })

  test("A member can't undo a rent change", async () => {
    const id = await withIncrease()
    expect(await undoTenancyRent(deps('jussi'), flat, id)).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect(await tenancyRents(id)).toHaveLength(2)
  })
})
