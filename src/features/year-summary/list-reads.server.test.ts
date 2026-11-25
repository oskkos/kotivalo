// The reads by a list of flats that the year summary loads with (openspec:
// year-summary, design decision 2): each keeps the flats' rows apart, gives
// them in the order of the per-flat read and returns nothing for no ids.
import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { recurringAmountRepository } from '#/features/recurring-amounts/recurring-amount.repository.server'
import { rentPaymentRepository } from '#/features/rent-payments/rent-payment.repository.server'
import {
  tenancyRepository,
  type TenancyFields,
} from '#/features/tenancies/tenancy.repository.server'
import {
  transactionRepository,
  type TransactionFields,
} from '#/features/transactions/transaction.repository.server'
import { usageChargeRepository } from '#/features/usage-charges/usage-charge.repository.server'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'

const db = createDb(env.DB)
const now = new Date(Date.UTC(2026, 10, 25, 12, 0, 0))
const ownership = ownershipRepository(db)
const tenancies = tenancyRepository(db)
const payments = rentPaymentRepository(db)
const entries = transactionRepository(db)
const amounts = recurringAmountRepository(db)
const usage = usageChargeRepository(db)

const details = {
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2 as const,
  floorArea: 485,
}

const aino: TenancyFields = {
  tenantName: 'Aino Koski',
  tenantPhone: null,
  tenantEmail: null,
  contractType: 'fixed_term',
  contractMade: '2025-03-15',
  validFrom: '2025-03-15',
  termEnd: '2026-12-14',
  dueDay: 5,
}

const repair: TransactionFields = {
  type: 'expense',
  category: 'annual_repair',
  amount: 14550,
  date: '2025-11-12',
  note: null,
}

let flat = ''
let other = ''
let empty = ''
let flatTenancy = ''
let otherTenancy = ''

beforeEach(async () => {
  await emptyTables(
    'usage_charge_amounts',
    'usage_charges',
    'rent_payments',
    'tenancies',
    'transactions',
    'recurring_amounts',
    'financing_charges',
    'financing_treatments',
    'ownership_periods',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('annika')
  const property = propertyRepository(db)
  flat = (await property.create('annika', details, now, '2025-03-01')).id
  other = (await property.create('annika', details, now, '2024-01-01')).id
  empty = (await property.create('annika', details, now, '2025-03-01')).id
  flatTenancy = (await tenancies.create('annika', flat, aino, now)) ?? ''
  otherTenancy = (await tenancies.create('annika', other, aino, now)) ?? ''
})

describe('Reads by a list of flats', () => {
  test('ownership periods are kept apart by flat', async () => {
    const byFlat = await ownership.rowsFor([flat, other, empty])
    expect(byFlat[flat]?.map((p) => p.validFrom)).toEqual(['2025-03-01'])
    expect(byFlat[other]?.map((p) => p.validFrom)).toEqual(['2024-01-01'])
    expect(byFlat[flat]?.[0]?.shares).toEqual([
      { userId: 'annika', share: 10000 },
    ])
    expect((await ownership.rowsFor([flat]))[other]).toBeUndefined()
  })

  test('tenancies are kept apart and ordered as the per-flat read', async () => {
    const all = await tenancies.forProperties([flat, other])
    expect(all.map((t) => [t.id, t.propertyId]).sort()).toEqual(
      [
        [flatTenancy, flat],
        [otherTenancy, other],
      ].sort(),
    )
    expect(await tenancies.forProperties([flat])).toEqual(
      await tenancies.forProperty(flat),
    )
  })

  test('rent payments are kept apart and ordered by month, then date', async () => {
    const pay = (tenancyId: string, month: string, paidOn: string) =>
      payments.record(
        'annika',
        tenancyId === flatTenancy ? flat : other,
        { tenancyId, month, amount: 89000, paidOn },
        now,
      )
    await pay(flatTenancy, '2025-05', '2025-05-04')
    await pay(flatTenancy, '2025-04', '2025-04-20')
    await pay(flatTenancy, '2025-04', '2025-04-03')
    await pay(otherTenancy, '2025-04', '2025-04-05')
    const rows = await payments.forProperties([flat, other])
    expect(
      rows.filter((p) => p.propertyId === flat).map((p) => p.paidOn),
    ).toEqual(['2025-04-03', '2025-04-20', '2025-05-04'])
    expect(rows.filter((p) => p.propertyId === other)).toHaveLength(1)
    expect(await payments.forProperties([empty])).toEqual([])
  })

  test("entries of the year are kept apart, newest first, without other years'", async () => {
    await entries.create('annika', flat, repair, null, now)
    await entries.create(
      'annika',
      flat,
      { ...repair, date: '2025-12-01' },
      null,
      now,
    )
    await entries.create(
      'annika',
      flat,
      { ...repair, date: '2024-12-31' },
      null,
      now,
    )
    await entries.create('annika', other, repair, null, now)
    const rows = await entries.forPropertiesYear([flat, other], 2025)
    expect(
      rows.filter((e) => e.propertyId === flat).map((e) => e.date),
    ).toEqual(['2025-12-01', '2025-11-12'])
    expect(rows.filter((e) => e.propertyId === other)).toHaveLength(1)
  })

  test('charges, financing charges and treatments are kept apart, every flat with an entry', async () => {
    const set = (propertyId: string, amount: number) =>
      amounts.setAmount({
        propertyId,
        actorId: 'annika',
        kind: 'maintenance_charge',
        amount,
        from: '2025-03-01',
        latestStart: null,
      })
    await set(flat, 19617)
    await set(other, 24458)
    await amounts.addFinancingCharge({
      propertyId: flat,
      actorId: 'annika',
      chargeId: crypto.randomUUID(),
      name: 'Putkiremontti',
      amount: 6050,
      from: '2025-03-01',
    })
    await amounts.setTreatment({
      propertyId: flat,
      actorId: 'annika',
      treatment: 'capitalised',
      from: '2025-03-01',
      latestStart: null,
    })
    const byFlat = await amounts.forProperties([flat, other, empty])
    expect(byFlat[flat]).toEqual(await amounts.forProperty(flat))
    expect(byFlat[flat].financingCharges).toHaveLength(1)
    expect(byFlat[flat].treatments).toHaveLength(1)
    expect(byFlat[other].amounts.maintenance_charge[0]?.value).toBe(24458)
    expect(byFlat[other].financingCharges).toEqual([])
    expect(byFlat[empty]).toEqual({
      amounts: { maintenance_charge: [] },
      financingCharges: [],
      treatments: [],
    })
  })

  test('usage charges are kept apart and ordered as the per-flat read', async () => {
    const add = (propertyId: string, from: string, kind: 'water' | 'sauna') =>
      usage.add({
        actorId: 'annika',
        propertyId,
        kind,
        basis: 'fixed',
        description: null,
        amount: 2200,
        from,
      })
    await add(flat, '2026-01-01', 'water')
    await add(flat, '2025-03-01', 'sauna')
    await add(other, '2025-03-01', 'water')
    const byFlat = await usage.forProperties([flat, other, empty])
    expect(byFlat[flat].map((c) => c.kind)).toEqual(['sauna', 'water'])
    expect(byFlat[flat]).toEqual(await usage.forProperty(flat))
    expect(byFlat[other]).toHaveLength(1)
    expect(byFlat[empty]).toEqual([])
  })

  test('an empty list of flats reads nothing', async () => {
    expect(await ownership.rowsFor([])).toEqual({})
    expect(await tenancies.forProperties([])).toEqual([])
    expect(await payments.forProperties([])).toEqual([])
    expect(await entries.forPropertiesYear([], 2025)).toEqual([])
    expect(await amounts.forProperties([])).toEqual({})
    expect(await usage.forProperties([])).toEqual({})
  })
})
