import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import {
  tenancyRepository,
  type TenancyFields,
} from '#/features/tenancies/tenancy.repository.server'
import { createDb } from '#/server/platform/db.server'
import { createCaptureLogger } from '#/server/platform/logger.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { rentPaymentRepository } from './rent-payment.repository.server'
import {
  deleteRentPayment,
  getRentMonth,
  getRentPayments,
  listRentThisMonth,
  recordRentPayment,
  type RentPaymentDeps,
} from './rent-payments.server'

const db = createDb(env.DB)
// 22 November 2026 at noon in Finland.
const now = new Date(Date.UTC(2026, 10, 22, 10, 0, 0))
let capture = createCaptureLogger()
let flat = ''
let tenancy = ''

function deps(userId = 'annika'): RentPaymentDeps {
  return {
    userId,
    payments: rentPaymentRepository(db),
    tenancies: tenancyRepository(db),
    properties: propertyRepository(db),
    sharing: sharingRepository(db),
    log: capture.log,
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
}

const november = (amount = 89000, paidOn = '2026-11-22') => ({
  tenancyId: tenancy,
  month: '2026-11',
  amount,
  paidOn,
})

beforeEach(async () => {
  capture = createCaptureLogger()
  await emptyTables(
    'rent_payments',
    'tenancies',
    'recurring_amounts',
    'financing_treatments',
    'ownership_periods',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('annika')
  await addTestUser('jussi')
  await addTestUser('stranger')
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
  tenancy =
    (await tenancyRepository(db).create('annika', flat, aino, now)) ?? ''
  await tenancyRepository(db).setRent({
    actorId: 'annika',
    propertyId: flat,
    tenancyId: tenancy,
    amount: 89000,
    from: '2025-03-01',
    latestStart: null,
  })
})

describe('Recording a rent payment', () => {
  test('records a payment and logs it with ids only', async () => {
    const result = await recordRentPayment(deps(), flat, november())
    expect(result.ok).toBe(true)
    const view = await getRentPayments(deps('jussi'), flat)
    expect(view.ok && view.payments.map((p) => [p.month, p.amount])).toEqual([
      ['2026-11', 89000],
    ])
    expect(capture.lines.at(-1)).toMatchObject({
      level: 'info',
      event: 'rent_payment.recorded',
      propertyId: flat,
      tenancyId: tenancy,
    })
    expect(JSON.stringify(capture.lines)).not.toContain('89000')
  })

  test('A payment date in the future is refused', async () => {
    expect(
      await recordRentPayment(deps(), flat, november(89000, '2026-11-23')),
    ).toEqual({ ok: false, reason: 'rent_payment_date_in_future' })
  })

  test('A month outside the tenancy is refused', async () => {
    expect(
      await recordRentPayment(deps(), flat, {
        ...november(),
        month: '2025-02',
      }),
    ).toEqual({ ok: false, reason: 'rent_payment_month_outside_tenancy' })
    const view = await getRentPayments(deps(), flat)
    expect(view.ok && view.payments).toEqual([])
  })

  test("A member can't record a payment", async () => {
    expect(await recordRentPayment(deps('jussi'), flat, november())).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
  })

  test('a stranger is refused as not found', async () => {
    expect(await recordRentPayment(deps('stranger'), flat, november())).toEqual(
      { ok: false, reason: 'property_not_found' },
    )
  })

  test("another flat's tenancy is refused", async () => {
    expect(
      await recordRentPayment(deps(), flat, {
        ...november(),
        tenancyId: 'nope',
      }),
    ).toEqual({ ok: false, reason: 'tenancy_not_found' })
  })
})

describe('Deleting a rent payment', () => {
  test('deletes a payment and logs it', async () => {
    const recorded = await recordRentPayment(deps(), flat, november())
    const id = recorded.ok ? recorded.paymentId : ''
    expect(await deleteRentPayment(deps(), flat, id)).toEqual({ ok: true })
    expect(capture.lines.at(-1)).toMatchObject({
      event: 'rent_payment.deleted',
      paymentId: id,
    })
    expect(await deleteRentPayment(deps(), flat, id)).toEqual({
      ok: false,
      reason: 'rent_payment_not_found',
    })
  })

  test("A member can't delete a payment", async () => {
    const recorded = await recordRentPayment(deps(), flat, november())
    const id = recorded.ok ? recorded.paymentId : ''
    expect(await deleteRentPayment(deps('jussi'), flat, id)).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    const view = await getRentPayments(deps(), flat)
    expect(view.ok && view.payments).toHaveLength(1)
  })
})

describe('The rent payment views', () => {
  test('give everyone with access the tenancies, the rent and the payments', async () => {
    await recordRentPayment(deps(), flat, november(50000, '2026-11-04'))
    const view = await getRentPayments(deps('jussi'), flat)
    expect(view).toMatchObject({
      ok: true,
      role: 'member',
      today: '2026-11-22',
      rents: {
        [tenancy]: [{ validFrom: '2025-03-01', validTo: null, value: 89000 }],
      },
    })
    expect(view.ok && view.tenancies.map((t) => t.tenantName)).toEqual([
      'Aino Koski',
    ])
  })

  test('narrow to a month of a tenancy', async () => {
    await recordRentPayment(deps(), flat, november(50000, '2026-11-04'))
    await recordRentPayment(deps(), flat, {
      ...november(),
      month: '2026-10',
    })
    const month = await getRentMonth(deps(), flat, tenancy, '2026-11')
    expect(month.ok && month.payments.map((p) => p.amount)).toEqual([50000])
    expect(await getRentMonth(deps(), flat, tenancy, '2025-02')).toEqual({
      ok: false,
      reason: 'rent_payment_month_outside_tenancy',
    })
    expect(await getRentMonth(deps(), flat, 'nope', '2026-11')).toEqual({
      ok: false,
      reason: 'tenancy_not_found',
    })
  })

  test('give the occupants and the tenant fees with the rent', async () => {
    await env.DB.prepare(
      "INSERT INTO tenancy_occupants (id, tenancy_id, persons, valid_from) VALUES ('o1', ?, 2, '2025-03-01')",
    )
      .bind(tenancy)
      .run()
    await env.DB.prepare(
      "INSERT INTO tenant_fees (id, tenancy_id, kind, basis) VALUES ('f1', ?, 'water', 'per_occupant')",
    )
      .bind(tenancy)
      .run()
    await env.DB.prepare(
      "INSERT INTO tenant_fee_amounts (id, tenant_fee_id, amount, valid_from) VALUES ('a1', 'f1', 2200, '2025-03-01')",
    ).run()
    const view = await getRentPayments(deps('jussi'), flat)
    expect(view.ok && view.occupants).toEqual({
      [tenancy]: [{ validFrom: '2025-03-01', validTo: null, value: 2 }],
    })
    expect(view.ok && view.fees[tenancy]).toEqual([
      expect.objectContaining({
        id: 'f1',
        kind: 'water',
        amounts: [{ validFrom: '2025-03-01', validTo: null, value: 2200 }],
      }),
    ])
    const month = await listRentThisMonth(deps('jussi'))
    expect(month.flats[0]?.fees?.[tenancy]).toHaveLength(1)
  })

  test('a stranger gets not found', async () => {
    expect(await getRentPayments(deps('stranger'), flat)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })
})

describe("This month's rent across the user's flats", () => {
  test("gives an owner and a member the flat's tenancies, rent and this month's payments", async () => {
    await recordRentPayment(deps(), flat, november(50000))
    await recordRentPayment(deps(), flat, {
      ...november(),
      month: '2026-10',
      paidOn: '2026-10-03',
    })
    for (const user of ['annika', 'jussi']) {
      const view = await listRentThisMonth(deps(user))
      expect(view.today).toBe('2026-11-22')
      expect(view.flats).toEqual([
        {
          propertyId: flat,
          tenancies: [expect.objectContaining({ id: tenancy })],
          rents: {
            [tenancy]: [
              { validFrom: '2025-03-01', validTo: null, value: 89000 },
            ],
          },
          occupants: {},
          fees: {},
          payments: [
            {
              tenancyId: tenancy,
              month: '2026-11',
              amount: 50000,
              paidOn: '2026-11-22',
            },
          ],
        },
      ])
    }
  })

  test("leaves a stranger's flats out", async () => {
    expect((await listRentThisMonth(deps('stranger'))).flats).toEqual([])
  })

  test('includes a tenancy that ended earlier this month and leaves out one that ended before', async () => {
    await env.DB.prepare(
      "UPDATE tenancies SET valid_from = '2026-11-15', contract_made = '2026-11-01' WHERE id = ?",
    )
      .bind(tenancy)
      .run()
    const fixedTerm = (tenantName: string, from: string, to: string) =>
      tenancyRepository(db).create(
        'annika',
        flat,
        {
          ...aino,
          tenantName,
          contractType: 'fixed_term',
          contractMade: from,
          validFrom: from,
          termEnd: to,
        },
        now,
      )
    await fixedTerm('Pekka', '2024-01-01', '2026-10-31')
    const ville = await fixedTerm('Ville', '2026-11-01', '2026-11-14')
    const view = await listRentThisMonth(deps())
    expect(view.flats[0]?.tenancies.map((t) => t.id)).toEqual([ville, tenancy])
  })
})
