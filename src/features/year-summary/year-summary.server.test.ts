import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { depositReturnRepository } from '#/features/deposits/deposit-return.repository.server'
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
    depositReturns: depositReturnRepository(database),
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
  for (const id of ['annika', 'jussi', 'mikko', 'stranger', 'solo', 'trio']) {
    await addTestUser(id)
  }
  for (const [id, name] of [
    ['annika', 'Annika'],
    ['jussi', 'Jussi Laine'],
    ['mikko', 'Mikko Virtanen'],
  ]) {
    await env.DB.prepare('UPDATE user SET name = ? WHERE id = ?')
      .bind(name, id)
      .run()
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
    // A member without a share moves between the years of the whole flats.
    expect(view.years).toEqual([2025, 2026])
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

  test('A card leaves out payment rows and tenants', async () => {
    const view = await loadYearSummary(deps(), 2025)
    expect(JSON.stringify(view)).not.toContain('paidOn')
    expect(JSON.stringify(view)).not.toContain('Aino')
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

  test('more tenancies and fees than D1 binds in one query still load', async () => {
    // 110 earlier one-month tenancies of Rantatie, each with a rent, its
    // occupants and two fees: over D1's 100 bound parameters per query.
    const statements = Array.from({ length: 110 }, (_, i) => {
      const id = `old-${String(i)}`
      const from = `${String(2010 + Math.floor(i / 12))}-${String((i % 12) + 1).padStart(2, '0')}-01`
      const to = `${from.slice(0, 8)}28`
      return [
        env.DB.prepare(
          "INSERT INTO tenancies (id, property_id, tenant_name, contract_type, contract_made, valid_from, valid_to, due_day, created_by, created_at, updated_at) VALUES (?, ?, 'Aino Koski', 'open_ended', ?, ?, ?, 5, 'annika', ?, ?)",
        ).bind(id, rantatie, from, from, to, now.getTime(), now.getTime()),
        env.DB.prepare(
          'INSERT INTO tenancy_rents (id, tenancy_id, amount, valid_from, valid_to) VALUES (?, ?, 89000, ?, ?)',
        ).bind(`${id}-rent`, id, from, to),
        env.DB.prepare(
          'INSERT INTO tenancy_occupants (id, tenancy_id, persons, valid_from, valid_to) VALUES (?, ?, 1, ?, ?)',
        ).bind(`${id}-occupants`, id, from, to),
        ...['water', 'parking'].flatMap((kind) => [
          env.DB.prepare(
            "INSERT INTO tenant_fees (id, tenancy_id, kind, basis, description) VALUES (?, ?, ?, 'fixed', NULL)",
          ).bind(`${id}-${kind}`, id, kind),
          env.DB.prepare(
            'INSERT INTO tenant_fee_amounts (id, tenant_fee_id, amount, valid_from, valid_to) VALUES (?, ?, 1500, ?, ?)',
          ).bind(`${id}-${kind}-amount`, `${id}-${kind}`, from, to),
        ]),
      ]
    })
    await env.DB.batch(statements.flat())
    const view = await loadYearSummary(deps(), 2025)
    expect(view.flats.map((f) => f.propertyId)).toContain(rantatie)
    const flat = await loadFlatYear(deps(), rantatie, 2025)
    expect(flat.ok && flat.flat?.rows['2.1'].cents).toBe(89000)
  })
})

describe('Rent kept from the deposit', () => {
  test('The rent kept counts in the year of the return', async () => {
    const [tenancy] = await tenancyRepository(db).forProperty(rantatie)
    const id = await depositReturnRepository(db).record(
      'annika',
      rantatie,
      tenancy.id,
      { returnedOn: '2025-06-10', rentKept: 30000, damageKept: 0, note: null },
      [{ month: '2025-05', amount: 30000 }],
      now,
    )
    expect(id).not.toBeNull()
    const flat = await loadFlatYear(deps(), rantatie, 2025)
    expect(flat.ok && flat.flat?.rows['2.1'].cents).toBe(119000)
    const next = await loadFlatYear(deps(), rantatie, 2026)
    expect(next.ok && next.flat?.rows['2.1'].cents).toBe(0)
  })
})

/** Annika and `other` 50 % each of a new flat of Annika, from `from`. */
async function coOwn(
  address: string,
  other: string,
  from: string,
  to?: string,
) {
  const id = await seedFlat('annika', address)
  await addAccess(id, other)
  await ownershipRepository(db).change({
    propertyId: id,
    actorId: 'annika',
    currentStart: '2025-01-01',
    from,
    reason: 'sale',
    split: [
      { userId: 'annika', share: 5000 },
      { userId: other, share: 5000 },
    ],
    removeAccess: [],
  })
  if (to !== undefined) {
    await ownershipRepository(db).change({
      propertyId: id,
      actorId: 'annika',
      currentStart: from,
      from: to,
      reason: 'sale',
      split: [{ userId: 'annika', share: 10000 }],
      removeAccess: [other],
    })
  }
  return id
}

describe('Choosing whose figures', () => {
  test("The sheet lists the year's owners", async () => {
    const koivupolku = await coOwn(
      'Koivupolku 7 A 4',
      'mikko',
      '2025-01-01',
      '2025-07-01',
    )
    const view = await loadYearSummary(deps(), 2025)
    expect(view.holder).toEqual({ kind: 'own' })
    expect(view.people).toEqual([
      { userId: 'jussi', name: 'Jussi Laine', flats: 1 },
      { userId: 'mikko', name: 'Mikko Virtanen', flats: 1 },
    ])
    expect(view.counts).toEqual({ own: 3, whole: 3 })
    expect(view.flats.map((f) => f.propertyId)).toContain(koivupolku)
  })

  test('No selector for a sole owner', async () => {
    await seedFlat('solo', 'Kuusikuja 1')
    const view = await loadYearSummary(deps('solo'), 2025)
    expect(view.people).toEqual([])
    expect(view.counts).toEqual({ own: 1, whole: 1 })
  })

  test('A person without a share that year', async () => {
    const koivupolku = await coOwn(
      'Koivupolku 7 A 4',
      'jussi',
      '2025-01-01',
      '2025-07-01',
    )
    // Jussi also co-owns Kuusikuja: leave him only Koivupolku, ended 2025-06-30.
    await env.DB.prepare('DELETE FROM properties WHERE id = ?')
      .bind(kuusikuja)
      .run()
    const view = await loadYearSummary(deps(), 2026, 'jussi')
    expect(view.holder).toEqual({
      kind: 'person',
      userId: 'jussi',
      name: 'Jussi Laine',
    })
    expect(view.year).toBe(2026)
    expect(view.flats).toEqual([])
    expect(view.notIncluded.map((f) => f.propertyId)).toContain(koivupolku)
  })

  test('An unknown person in the URL', async () => {
    const own = await loadYearSummary(deps(), 2025)
    const view = await loadYearSummary(deps(), 2025, 'someone-else')
    expect(view).toEqual(own)
    // A person who owns none of the user's flats stays unknown.
    await seedFlat('mikko', 'Pyynikintie 5 A 3')
    expect(await loadYearSummary(deps(), 2025, 'mikko')).toEqual(own)
  })
})

describe("Another owner's figures", () => {
  test("A co-owner's cards", async () => {
    const view = await loadYearSummary(deps(), 2025, 'jussi')
    expect(view.holder).toMatchObject({ kind: 'person', name: 'Jussi Laine' })
    expect(view.flats).toHaveLength(1)
    expect(view.flats[0]).toMatchObject({
      propertyId: kuusikuja,
      share: 5000,
      income: 44500,
      costs: 132000,
    })
    expect(view.notIncluded).toEqual([
      { propertyId: rantatie, streetAddress: 'Rantatie 15 C 21' },
    ])
  })

  test("A member sees an owner's figures", async () => {
    const view = await loadYearSummary(deps('stranger'), 2025, 'annika')
    expect(view.flats).toEqual([])
    await addAccess(kuusikuja, 'stranger')
    const seen = await loadYearSummary(deps('stranger'), 2025, 'annika')
    expect(seen.holder).toMatchObject({ kind: 'person', name: 'Annika' })
    expect(seen.flats.map((f) => f.propertyId)).toEqual([kuusikuja])
    expect(seen.flats[0]).toMatchObject({ share: 5000, income: 44500 })
  })

  test("A flat the user can't see is not counted", async () => {
    await coOwn('Koivupolku 7 A 4', 'mikko', '2025-03-01')
    const pyynikintie = await seedFlat('mikko', 'Pyynikintie 5 A 3')
    const view = await loadYearSummary(deps(), 2025, 'mikko')
    expect(JSON.stringify(view)).not.toContain(pyynikintie)
    expect(JSON.stringify(view)).not.toContain('Pyynikintie')
    expect(view.flats.map((f) => f.streetAddress)).toEqual(['Koivupolku 7 A 4'])
  })

  test("A co-owner's form 7H page", async () => {
    const view = await loadFlatYear(deps(), kuusikuja, 2025, 'jussi')
    expect(view).toMatchObject({
      ok: true,
      holder: { kind: 'person', name: 'Jussi Laine' },
      owners: [],
      flat: { details: { share: 5000 }, rows: { '2.1': { cents: 44500 } } },
    })
  })
})

describe('The whole flats', () => {
  test('The whole flats include a flat without the own share', async () => {
    const hallilantie = await seedFlat('jussi', 'Hallilantie 12 B 8')
    await addAccess(hallilantie, 'annika')
    const view = await loadYearSummary(deps(), 2025, 'whole')
    expect(view.holder).toEqual({ kind: 'whole' })
    expect(view.flats.map((f) => f.propertyId).sort()).toEqual(
      [hallilantie, kuusikuja, rantatie].sort(),
    )
    const card = view.flats.find((f) => f.propertyId === kuusikuja)
    expect(card).toMatchObject({ share: 10000, income: 89000 })
    expect(card?.owners).toEqual([
      { name: 'Annika', share: 5000, isYou: true },
      { name: 'Jussi Laine', share: 5000, isYou: false },
    ])
    expect(view.notIncluded).toEqual([])
  })

  test('An owner change in the middle of the year', async () => {
    await coOwn('Koivupolku 7 A 4', 'jussi', '2025-01-01', '2025-07-01')
    const view = await loadYearSummary(deps(), 2025, 'whole')
    const card = view.flats.find((f) => f.streetAddress === 'Koivupolku 7 A 4')
    expect(card?.owners).toEqual([
      { name: 'Annika', share: 10000, isYou: true },
      { name: 'Jussi Laine', share: 5000, isYou: false },
    ])
    expect(card?.checks.some((c) => c.kind === 'share_changed')).toBe(false)
  })
})

describe('The year the summary opens on', () => {
  test('The years of another owner', async () => {
    await coOwn('Koivupolku 7 A 4', 'mikko', '2026-03-01')
    expect((await loadYearSummary(deps(), undefined, 'mikko')).years).toEqual([
      2026,
    ])
    expect((await loadYearSummary(deps(), undefined, 'whole')).years).toEqual([
      2024, 2025, 2026,
    ])
  })

  test('A member without a share moves between years', async () => {
    const flat = await seedFlat('annika', 'Koivupolku 7 A 4', '2022-06-12')
    await addAccess(flat, 'stranger')
    const view = await loadYearSummary(deps('stranger'))
    expect(view.years).toEqual([2022, 2023, 2024, 2025, 2026])
    expect(view.holderHasYears).toBe(false)
    expect(view.holder).toEqual({ kind: 'own' })
    expect(view.year).toBe(2026)
  })
})

describe("The whole flat's page", () => {
  test("The whole flat's rows and owners", async () => {
    const view = await loadFlatYear(deps(), kuusikuja, 2025, 'whole')
    expect(view).toMatchObject({
      ok: true,
      holder: { kind: 'whole' },
      flat: { rows: { '2.1': { cents: 89000 } } },
    })
    if (!view.ok) {
      return
    }
    expect(view.owners).toEqual([
      {
        userId: 'annika',
        name: 'Annika',
        share: 5000,
        income: 44500,
        isYou: true,
      },
      {
        userId: 'jussi',
        name: 'Jussi Laine',
        share: 5000,
        income: 44500,
        isYou: false,
      },
    ])
  })
})
