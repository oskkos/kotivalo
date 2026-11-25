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
import { transactionRepository } from '#/features/transactions/transaction.repository.server'
import { usageChargeRepository } from '#/features/usage-charges/usage-charge.repository.server'
import { createDb } from '#/server/platform/db.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import {
  loadFlatYear,
  loadYearSummary,
  type YearSummaryDeps,
} from './year-summary.server'

const db = createDb(env.DB)
// 25 November 2026 at noon in Finland.
const now = new Date(Date.UTC(2026, 10, 25, 10, 0, 0))

function deps(userId = 'annika', database = db): YearSummaryDeps {
  return {
    userId,
    properties: propertyRepository(database),
    ownership: ownershipRepository(database),
    tenancies: tenancyRepository(database),
    payments: rentPaymentRepository(database),
    transactions: transactionRepository(database),
    amounts: recurringAmountRepository(database),
    usageCharges: usageChargeRepository(database),
    now: () => now,
  }
}

/** The database with every statement prepared or batched counted. */
function countingDb() {
  const counter = { queries: 0 }
  const d1 = Object.assign(Object.create(env.DB) as D1Database, {
    prepare: (query: string) => {
      counter.queries += 1
      return env.DB.prepare(query)
    },
    batch: <T>(statements: D1PreparedStatement[]) => {
      counter.queries += 1
      return env.DB.batch<T>(statements)
    },
  })
  return { db: createDb(d1), counter }
}

const details = (streetAddress: string) => ({
  streetAddress,
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2 as const,
  floorArea: 485,
})

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

const addAccess = (propertyId: string, userId: string, role = 'member') =>
  env.DB.prepare(
    'INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(propertyId, userId, role, now.getTime())
    .run()

/**
 * A flat of `owner` from `from`, with a maintenance charge, a water usage
 * charge, a tenancy and one rent payment in April 2025.
 */
async function seedFlat(owner: string, address: string, from = '2025-01-01') {
  const id = (
    await propertyRepository(db).create(owner, details(address), now, from)
  ).id
  await recurringAmountRepository(db).setAmount({
    propertyId: id,
    actorId: owner,
    kind: 'maintenance_charge',
    amount: 20000,
    from,
    latestStart: null,
  })
  await usageChargeRepository(db).add({
    actorId: owner,
    propertyId: id,
    kind: 'water',
    basis: 'fixed',
    description: null,
    amount: 2000,
    from,
  })
  const tenancy =
    (await tenancyRepository(db).create(owner, id, aino, now)) ?? ''
  await rentPaymentRepository(db).record(
    owner,
    id,
    {
      tenancyId: tenancy,
      month: '2025-04',
      amount: 89000,
      paidOn: '2025-04-04',
    },
    now,
  )
  return id
}

let kuusikuja = ''
let rantatie = ''

beforeEach(async () => {
  await emptyTables(
    'usage_charge_amounts',
    'usage_charges',
    'rent_payments',
    'tenant_fee_amounts',
    'tenant_fees',
    'tenancy_occupants',
    'tenancy_rents',
    'tenancies',
    'receipts',
    'transactions',
    'recurring_amounts',
    'financing_charges',
    'financing_treatments',
    'ownership_periods',
    'property_invitations',
    'property_access',
    'properties',
    'user',
  )
  for (const id of ['annika', 'jussi', 'stranger', 'solo', 'trio']) {
    await addTestUser(id)
  }
  // Kuusikuja: Annika and Jussi 50 % each from 1 May 2024.
  kuusikuja = await seedFlat('annika', 'Kuusikuja 3 B 12', '2024-05-01')
  await addAccess(kuusikuja, 'jussi')
  await ownershipRepository(db).change({
    propertyId: kuusikuja,
    actorId: 'annika',
    currentStart: '2024-05-01',
    from: '2024-05-01',
    reason: 'sale',
    split: [
      { userId: 'annika', share: 5000 },
      { userId: 'jussi', share: 5000 },
    ],
    removeAccess: [],
  })
  rantatie = await seedFlat('annika', 'Rantatie 15 C 21')
})

describe('The year summary page', () => {
  test('The cards of the flats owned in the year', async () => {
    const view = await loadYearSummary(deps(), 2025)
    expect(view.year).toBe(2025)
    expect(view.years).toEqual([2024, 2025, 2026])
    const byAddress = Object.fromEntries(
      view.flats.map((card) => [card.streetAddress, card]),
    )
    expect(byAddress['Kuusikuja 3 B 12']).toMatchObject({
      propertyId: kuusikuja,
      share: 5000,
      income: 44500,
      // 12 × (200,00 + 20,00) € at 50 %.
      costs: 132000,
    })
    expect(byAddress['Rantatie 15 C 21']).toMatchObject({
      propertyId: rantatie,
      share: 10000,
      income: 89000,
      costs: 264000,
    })
    expect(view.notIncluded).toEqual([])
  })

  test('A flat without a share is named, not summarised', async () => {
    const hallilantie = await seedFlat('jussi', 'Hallilantie 12 B 8')
    await addAccess(hallilantie, 'annika')
    const view = await loadYearSummary(deps(), 2025)
    expect(view.flats.map((card) => card.propertyId)).not.toContain(hallilantie)
    expect(view.notIncluded).toEqual([
      { propertyId: hallilantie, streetAddress: 'Hallilantie 12 B 8' },
    ])
  })

  test('No share in any flat', async () => {
    const flat = await seedFlat('annika', 'Koivupolku 7 A 4')
    await addAccess(flat, 'stranger')
    const view = await loadYearSummary(deps('stranger'))
    expect(view.flats).toEqual([])
    expect(view.years).toEqual([])
    expect(view.notIncluded.map((f) => f.propertyId)).toEqual([flat])
  })

  test('Moving to the previous year', async () => {
    const view = await loadYearSummary(deps(), 2024)
    expect(view.year).toBe(2024)
    expect(view.flats.map((card) => card.propertyId)).toEqual([kuusikuja])
    expect(view.notIncluded.map((f) => f.propertyId)).toEqual([rantatie])
  })

  test('Without a year the summary opens on the opening year', async () => {
    // 25 November: the current year.
    expect((await loadYearSummary(deps())).year).toBe(2026)
  })

  test('A year outside the range opens the nearest year', async () => {
    expect((await loadYearSummary(deps(), 2010)).year).toBe(2024)
    expect((await loadYearSummary(deps(), 2040)).year).toBe(2026)
  })

  test('A card leaves out other owners and payment rows', async () => {
    const view = await loadYearSummary(deps(), 2025)
    expect(JSON.stringify(view)).not.toContain('jussi')
    expect(JSON.stringify(view)).not.toContain('paidOn')
  })
})

describe('Flats in the year summary', () => {
  test('An archived flat is included', async () => {
    await propertyRepository(db).setArchived('annika', kuusikuja, now)
    const view = await loadYearSummary(deps(), 2025)
    expect(view.flats.map((card) => card.propertyId)).toContain(kuusikuja)
  })
})

describe('The form 7H page of a flat', () => {
  test('The rows of a flat', async () => {
    const view = await loadFlatYear(deps(), rantatie, 2025)
    expect(view.ok).toBe(true)
    if (!view.ok) {
      return
    }
    expect(view.property.streetAddress).toBe('Rantatie 15 C 21')
    expect(view.flat?.rows['2.1'].cents).toBe(89000)
    expect(view.flat?.rows['2.2'].parts).toEqual([
      { key: 'maintenance_charge', cents: 240000 },
      { key: 'water', cents: 24000 },
    ])
    expect(view.flat?.details.tenant).toEqual({
      kind: 'one',
      name: 'Aino Koski',
    })
  })

  test("A flat the user can't see", async () => {
    expect(await loadFlatYear(deps('stranger'), kuusikuja, 2025)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })

  test('A flat without a share that year', async () => {
    const flat = await seedFlat('annika', 'Koivupolku 7 A 4')
    await addAccess(flat, 'jussi')
    const view = await loadFlatYear(deps('jussi'), flat, 2025)
    expect(view).toMatchObject({ ok: true, year: 2025, flat: null })
  })

  test('An archived flat opens', async () => {
    await propertyRepository(db).setArchived('annika', kuusikuja, now)
    const view = await loadFlatYear(deps(), kuusikuja, 2025)
    expect(view).toMatchObject({ ok: true, flat: { details: { share: 5000 } } })
  })
})

describe('Loading the year summary', () => {
  test('the number of queries does not grow with the flats', async () => {
    await seedFlat('solo', 'Kuusikuja 1')
    for (const address of ['Kuusikuja 2', 'Kuusikuja 4', 'Kuusikuja 6']) {
      await seedFlat('trio', address)
    }
    const one = countingDb()
    const three = countingDb()
    const soloView = await loadYearSummary(deps('solo', one.db), 2025)
    const trioView = await loadYearSummary(deps('trio', three.db), 2025)
    expect(soloView.flats).toHaveLength(1)
    expect(trioView.flats).toHaveLength(3)
    expect(three.counter.queries).toBe(one.counter.queries)
    expect(one.counter.queries).toBeGreaterThan(5)
    expect(one.counter.queries).toBeLessThanOrEqual(16)
  })
})
