import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { recurringAmountRepository } from '#/features/recurring-amounts/recurring-amount.repository.server'
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
    amounts: recurringAmountRepository(db),
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
  await recurringAmountRepository(db).setAmount({
    propertyId: flat,
    actorId: 'annika',
    kind: 'rent',
    amount: 89000,
    from: '2025-03-01',
    latestStart: null,
  })
  tenancy =
    (await tenancyRepository(db).create('annika', flat, aino, now)) ?? ''
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
      rents: [{ validFrom: '2025-03-01', validTo: null, value: 89000 }],
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

  test('a stranger gets not found', async () => {
    expect(await getRentPayments(deps('stranger'), flat)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })
})
