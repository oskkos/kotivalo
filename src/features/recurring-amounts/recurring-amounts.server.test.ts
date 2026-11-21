import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { createDb } from '#/server/platform/db.server'
import {
  createCaptureLogger,
  type LogLine,
} from '#/server/platform/logger.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { recurringAmountRepository } from './recurring-amount.repository.server'
import {
  getRecurringAmounts,
  setFinancingTreatment,
  setRecurringAmount,
  undoRecurringAmount,
  type RecurringAmountDeps,
} from './recurring-amounts.server'

const db = createDb(env.DB)
// 21 November 2026 at noon in Finland.
const now = new Date(Date.UTC(2026, 10, 21, 10, 0, 0))
let logLines: LogLine[] = []
let flat = ''

function deps(userId: string): RecurringAmountDeps {
  const capture = createCaptureLogger()
  logLines = capture.lines
  return {
    userId,
    amounts: recurringAmountRepository(db),
    ownership: ownershipRepository(db),
    sharing: sharingRepository(db),
    log: capture.log,
    now: () => now,
  }
}

const set = (
  kind: 'rent' | 'maintenance_charge' | 'financing_charge',
  amount: number,
  from: string,
  userId = 'annika',
) => setRecurringAmount(deps(userId), flat, { kind, amount, from })

const view = async (userId = 'annika') => {
  const result = await getRecurringAmounts(deps(userId), flat)
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result
}

beforeEach(async () => {
  await emptyTables(
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

describe('Getting the rent and charges', () => {
  test('a member sees the amounts, someone without access does not', async () => {
    await set('rent', 89000, '2025-03-01')
    const seen = await view('jussi')
    expect(seen.role).toBe('member')
    expect(seen.amounts.rent).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 89000 },
    ])
    expect(await getRecurringAmounts(deps('liisa'), flat)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })

  test('the view carries today, the ownership start and the capitalised sum', async () => {
    await set('financing_charge', 8000, '2025-03-01')
    await setFinancingTreatment(deps('annika'), flat, {
      treatment: 'capitalised',
      from: '2025-03-01',
    })
    const seen = await view()
    expect(seen.today).toBe('2026-11-21')
    expect(seen.ownershipStart).toBe('2025-03-01')
    expect(seen.capitalised).toBe(21 * 8000)
  })
})

describe('Setting a rent or charge', () => {
  test('Setting the first rent of a flat', async () => {
    expect(await set('rent', 89000, '2025-03-01')).toEqual({ ok: true })
    expect((await view()).amounts.rent).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 89000 },
    ])
  })

  test("An amount on the latest period's start corrects it", async () => {
    await set('rent', 89000, '2025-03-01')
    await set('rent', 92000, '2027-03-01')
    expect(await set('rent', 95000, '2027-03-01')).toEqual({ ok: true })
    expect((await view()).amounts.rent).toEqual([
      { validFrom: '2025-03-01', validTo: '2027-02-28', value: 89000 },
      { validFrom: '2027-03-01', validTo: null, value: 95000 },
    ])
  })

  test("A date before the flat's ownership is refused", async () => {
    expect(await set('rent', 89000, '2025-01-01')).toEqual({
      ok: false,
      reason: 'amount_date_before_ownership',
    })
    expect((await view()).amounts.rent).toEqual([])
  })

  test('A date before the latest change is refused', async () => {
    await set('maintenance_charge', 21400, '2026-01-01')
    expect(await set('maintenance_charge', 20500, '2025-06-01')).toEqual({
      ok: false,
      reason: 'amount_date_too_early',
    })
    expect((await view()).amounts.maintenance_charge).toHaveLength(1)
  })

  test("A date that isn't the first of a month is refused", async () => {
    expect(await set('rent', 89000, '2027-03-15')).toEqual({
      ok: false,
      reason: 'amount_date_not_month_start',
    })
  })

  test("A member can't set an amount", async () => {
    expect(await set('rent', 89000, '2025-03-01', 'jussi')).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect((await view()).amounts.rent).toEqual([])
  })

  test('someone without access gets "not found"', async () => {
    expect(await set('rent', 89000, '2025-03-01', 'liisa')).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })

  test('setting an amount is logged with ids, not values', async () => {
    await set('rent', 89000, '2025-03-01')
    expect(logLines).toEqual([
      expect.objectContaining({
        level: 'info',
        event: 'recurring_amount.set',
        propertyId: flat,
        kind: 'rent',
        from: '2025-03-01',
        corrected: false,
      }),
    ])
    expect(JSON.stringify(logLines)).not.toContain('89000')
  })
})

describe('Undoing the latest rent or charge change', () => {
  test('Undoing a charge increase', async () => {
    await set('maintenance_charge', 21400, '2026-01-01')
    await set('maintenance_charge', 22600, '2027-01-01')
    expect(
      await undoRecurringAmount(deps('annika'), flat, 'maintenance_charge'),
    ).toEqual({ ok: true })
    expect(logLines).toEqual([
      expect.objectContaining({
        event: 'recurring_amount.undone',
        kind: 'maintenance_charge',
        from: '2027-01-01',
      }),
    ])
    expect((await view()).amounts.maintenance_charge).toEqual([
      { validFrom: '2026-01-01', validTo: null, value: 21400 },
    ])
  })

  test("The only period can't be undone", async () => {
    await set('rent', 89000, '2025-03-01')
    expect(await undoRecurringAmount(deps('annika'), flat, 'rent')).toEqual({
      ok: false,
      reason: 'amount_nothing_to_undo',
    })
  })

  test("a member can't undo", async () => {
    await set('rent', 89000, '2025-03-01')
    await set('rent', 92000, '2027-03-01')
    expect(await undoRecurringAmount(deps('jussi'), flat, 'rent')).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
  })
})

describe('The financing charge treatment', () => {
  test('A new treatment keeps the history', async () => {
    await setFinancingTreatment(deps('annika'), flat, {
      treatment: 'capitalised',
      from: '2025-03-01',
    })
    expect(
      await setFinancingTreatment(deps('annika'), flat, {
        treatment: 'income_recognised',
        from: '2027-01-01',
      }),
    ).toEqual({ ok: true })
    expect(logLines).toEqual([
      expect.objectContaining({
        event: 'financing_treatment.set',
        from: '2027-01-01',
        corrected: false,
      }),
    ])
    expect((await view()).treatments).toEqual([
      { validFrom: '2025-03-01', validTo: '2026-12-31', value: 'capitalised' },
      { validFrom: '2027-01-01', validTo: null, value: 'income_recognised' },
    ])
  })

  test("A member can't set the treatment", async () => {
    expect(
      await setFinancingTreatment(deps('jussi'), flat, {
        treatment: 'capitalised',
        from: '2025-03-01',
      }),
    ).toEqual({ ok: false, reason: 'sharing_owner_only' })
  })

  test('the treatment follows the same date rules', async () => {
    expect(
      await setFinancingTreatment(deps('annika'), flat, {
        treatment: 'capitalised',
        from: '2024-12-01',
      }),
    ).toEqual({ ok: false, reason: 'amount_date_before_ownership' })
  })
})
