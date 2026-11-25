import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import {
  documentRepository,
  type DocumentFields,
} from '#/features/documents/document.repository.server'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { recurringAmountRepository } from '#/features/recurring-amounts/recurring-amount.repository.server'
import { rentPaymentRepository } from '#/features/rent-payments/rent-payment.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { tenancyRepository } from '#/features/tenancies/tenancy.repository.server'
import { transactionRepository } from '#/features/transactions/transaction.repository.server'
import { usageChargeRepository } from '#/features/usage-charges/usage-charge.repository.server'
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
    documents: documentRepository(db),
    usageCharges: usageChargeRepository(db),
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
    'property_documents',
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
    expect(result.ok && result.financingCharges).toHaveLength(1)
  })

  test('gives the flat its housing company details', async () => {
    await propertyRepository(db).update(
      'annika',
      flat,
      {
        streetAddress: 'Kuusikuja 3 B 12',
        postcode: '33100',
        city: 'Tampere',
        roomCount: 2,
        floorArea: 485,
        housingCompanyName: 'As Oy Kuusikuja 3',
        businessId: '2345678-0',
        apartmentNumber: 'B 12',
      },
      now,
    )

    const result = await getFlatDetails(deps(), flat)

    expect(result).toMatchObject({
      ok: true,
      property: {
        housingCompanyName: 'As Oy Kuusikuja 3',
        businessId: '2345678-0',
        apartmentNumber: 'B 12',
      },
    })
  })

  test("gives the flat's usage charges with their periods", async () => {
    await usageChargeRepository(db).add({
      actorId: 'annika',
      propertyId: flat,
      kind: 'water',
      basis: 'per_occupant',
      description: null,
      amount: 2200,
      from: '2026-01-01',
    })
    const result = await getFlatDetails(deps('annika'), flat)
    expect(result.ok && result.usageCharges).toEqual([
      expect.objectContaining({
        kind: 'water',
        periods: [{ validFrom: '2026-01-01', validTo: null, value: 2200 }],
      }),
    ])
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

  test('gives the latest three documents by date and their number', async () => {
    const repository = documentRepository(db)
    const add = (name: string, date: DocumentFields['date']) =>
      repository.add(
        'annika',
        flat,
        { kind: 'other', name, date, tenancyId: null },
        {
          key: `attachments/${name}`,
          contentType: 'application/pdf',
          size: 10,
          filename: 'a.pdf',
        },
        now,
      )
    await add('Isännöitsijäntodistus', '2025-01-10')
    await add('Yhtiökokous 2026', '2026-05-15')
    await add('Vastikkeet 2026', '2026-01-02')
    await add('Tilinpäätös 2025', '2026-04-28')

    for (const userId of ['annika', 'jussi']) {
      const result = await getFlatDetails(deps(userId), flat)
      expect(result.ok && result.documents.count).toBe(4)
      expect(
        result.ok && result.documents.latest.map((document) => document.name),
      ).toEqual(['Yhtiökokous 2026', 'Tilinpäätös 2025', 'Vastikkeet 2026'])
    }
  })

  test('a flat without documents has none', async () => {
    const result = await getFlatDetails(deps(), flat)
    expect(result.ok && result.documents).toEqual({ latest: [], count: 0 })
  })
})
