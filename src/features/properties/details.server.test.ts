import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { recurringAmountRepository } from '#/features/recurring-amounts/recurring-amount.repository.server'
import { rentPaymentRepository } from '#/features/rent-payments/rent-payment.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { tenancyRepository } from '#/features/tenancies/tenancy.repository.server'
import { transactionRepository } from '#/features/transactions/transaction.repository.server'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { getFlatDetails, type FlatDetailsDeps } from './details.server'
import { propertyRepository } from './property.repository.server'

const db = createDb(env.DB)
const now = new Date(Date.UTC(2026, 10, 22, 10, 0, 0))
let flat = ''

function deps(userId = 'annika'): FlatDetailsDeps {
  return {
    userId,
    properties: propertyRepository(db),
    sharing: sharingRepository(db),
    ownership: ownershipRepository(db),
    tenancies: tenancyRepository(db),
    amounts: recurringAmountRepository(db),
    payments: rentPaymentRepository(db),
    transactions: transactionRepository(db),
    now: () => now,
  }
}

async function expense(date: string, note: string) {
  await transactionRepository(db).create(
    'annika',
    flat,
    { type: 'expense', category: 'annual_repair', amount: 14550, date, note },
    null,
    now,
  )
}

beforeEach(async () => {
  await emptyTables(
    'rent_payments',
    'receipts',
    'transactions',
    'tenancies',
    'recurring_amounts',
    'financing_charges',
    'financing_treatments',
    'ownership_periods',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('annika')
  await addTestUser('jussi')
  await addTestUser('stranger')
  await env.DB.prepare("UPDATE user SET name = 'Annika' WHERE id = 'annika'")
    .bind()
    .run()
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

describe('The flat details page', () => {
  test('gives an owner the flat, its owners, tenancies, amounts and payments', async () => {
    const amounts = recurringAmountRepository(db)
    await amounts.addFinancingCharge({
      propertyId: flat,
      actorId: 'annika',
      chargeId: 'charge',
      name: 'Putkiremontti',
      amount: 8000,
      from: '2026-09-01',
    })
    await amounts.setTreatment({
      propertyId: flat,
      actorId: 'annika',
      treatment: 'capitalised',
      from: '2026-09-01',
      latestStart: null,
    })
    const tenancy = await tenancyRepository(db).create(
      'annika',
      flat,
      {
        tenantName: 'Aino Koski',
        tenantPhone: null,
        tenantEmail: null,
        contractType: 'open_ended',
        contractMade: '2025-02-12',
        validFrom: '2025-03-01',
        termEnd: null,
        dueDay: 5,
      },
      now,
    )
    await rentPaymentRepository(db).record(
      'annika',
      flat,
      {
        tenancyId: tenancy ?? '',
        month: '2026-11',
        amount: 89000,
        paidOn: '2026-11-03',
      },
      now,
    )
    const result = await getFlatDetails(deps(), flat)
    expect(result).toMatchObject({
      ok: true,
      role: 'owner',
      property: { streetAddress: 'Kuusikuja 3 B 12' },
      owners: [{ name: 'Annika', share: 10000, isYou: true }],
      today: '2026-11-22',
      capitalised: 3 * 8000,
    })
    expect(result.ok && result.tenancies.map((t) => t.tenantName)).toEqual([
      'Aino Koski',
    ])
    expect(result.ok && result.payments.map((p) => p.amount)).toEqual([89000])
    expect(result.ok && result.amounts.financing_charge).toHaveLength(1)
  })

  test('lists the three latest entries', async () => {
    await expense('2026-10-15', 'd')
    await expense('2026-11-12', 'a')
    await expense('2026-10-28', 'c')
    await expense('2026-11-03', 'b')
    const result = await getFlatDetails(deps(), flat)
    expect(result.ok && result.latestEntries.map((e) => e.date)).toEqual([
      '2026-11-12',
      '2026-11-03',
      '2026-10-28',
    ])
  })

  test('gives a member the same page with their role', async () => {
    const result = await getFlatDetails(deps('jussi'), flat)
    expect(result).toMatchObject({
      ok: true,
      role: 'member',
      owners: [{ name: 'Annika', isYou: false }],
    })
  })

  test("Another user can't open the details page", async () => {
    expect(await getFlatDetails(deps('stranger'), flat)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })
})
