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
  addFinancingCharge,
  getRecurringAmounts,
  renameFinancingCharge,
  setFinancingTreatment,
  setRecurringAmount,
  undoFinancingTreatment,
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
  kind: 'maintenance_charge',
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
    'financing_charges',
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

describe('Getting the charges', () => {
  test('a member sees the amounts, someone without access does not', async () => {
    await set('maintenance_charge', 89000, '2025-03-01')
    const seen = await view('jussi')
    expect(seen.role).toBe('member')
    expect(seen.amounts.maintenance_charge).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 89000 },
    ])
    expect(await getRecurringAmounts(deps('liisa'), flat)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })

  test('the view carries today, the ownership start and the capitalised sum', async () => {
    await addFinancingCharge(deps('annika'), flat, {
      name: 'Putkiremontti',
      amount: 8000,
      from: '2025-03-01',
    })
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

describe('Setting a charge', () => {
  test('Setting the first maintenance charge of a flat', async () => {
    expect(await set('maintenance_charge', 89000, '2025-03-01')).toEqual({
      ok: true,
    })
    expect((await view()).amounts.maintenance_charge).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 89000 },
    ])
  })

  test("An amount on the latest period's start corrects it", async () => {
    await set('maintenance_charge', 89000, '2025-03-01')
    await set('maintenance_charge', 92000, '2027-03-01')
    expect(await set('maintenance_charge', 95000, '2027-03-01')).toEqual({
      ok: true,
    })
    expect((await view()).amounts.maintenance_charge).toEqual([
      { validFrom: '2025-03-01', validTo: '2027-02-28', value: 89000 },
      { validFrom: '2027-03-01', validTo: null, value: 95000 },
    ])
  })

  test("A date before the flat's ownership is refused", async () => {
    expect(await set('maintenance_charge', 89000, '2025-01-01')).toEqual({
      ok: false,
      reason: 'amount_date_before_ownership',
    })
    expect((await view()).amounts.maintenance_charge).toEqual([])
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
    expect(await set('maintenance_charge', 89000, '2027-03-15')).toEqual({
      ok: false,
      reason: 'amount_date_not_month_start',
    })
  })

  test("A member can't set an amount", async () => {
    expect(
      await set('maintenance_charge', 89000, '2025-03-01', 'jussi'),
    ).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect((await view()).amounts.maintenance_charge).toEqual([])
  })

  test('someone without access gets "not found"', async () => {
    expect(
      await set('maintenance_charge', 89000, '2025-03-01', 'liisa'),
    ).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })

  test('setting an amount is logged with ids, not values', async () => {
    await set('maintenance_charge', 89000, '2025-03-01')
    expect(logLines).toEqual([
      expect.objectContaining({
        level: 'info',
        event: 'recurring_amount.set',
        propertyId: flat,
        kind: 'maintenance_charge',
        from: '2025-03-01',
        corrected: false,
      }),
    ])
    expect(JSON.stringify(logLines)).not.toMatch(/(?<![\w-])89000(?![\w-])/)
  })
})

describe('Undoing the latest charge change', () => {
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

  test('Undoing the only maintenance charge', async () => {
    await set('maintenance_charge', 89000, '2025-06-01')
    expect(
      await undoRecurringAmount(deps('annika'), flat, 'maintenance_charge'),
    ).toEqual({
      ok: true,
    })
    expect(logLines).toEqual([
      expect.objectContaining({
        event: 'recurring_amount.undone',
        kind: 'maintenance_charge',
        from: '2025-06-01',
      }),
    ])
    expect((await view()).amounts.maintenance_charge).toEqual([])
    expect(await set('maintenance_charge', 89000, '2025-03-01')).toEqual({
      ok: true,
    })
    expect((await view()).amounts.maintenance_charge).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 89000 },
    ])
  })

  test('Nothing to undo is refused', async () => {
    expect(
      await undoRecurringAmount(deps('annika'), flat, 'maintenance_charge'),
    ).toEqual({
      ok: false,
      reason: 'amount_nothing_to_undo',
    })
  })

  test("a member can't undo", async () => {
    await set('maintenance_charge', 89000, '2025-03-01')
    await set('maintenance_charge', 92000, '2027-03-01')
    expect(
      await undoRecurringAmount(deps('jussi'), flat, 'maintenance_charge'),
    ).toEqual({
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

describe('Undoing the latest treatment change', () => {
  const treat = (
    treatment: 'capitalised' | 'income_recognised',
    from: string,
  ) => setFinancingTreatment(deps('annika'), flat, { treatment, from })

  test('Undoing a treatment change', async () => {
    await treat('capitalised', '2025-03-01')
    await treat('income_recognised', '2027-01-01')
    expect(await undoFinancingTreatment(deps('annika'), flat)).toEqual({
      ok: true,
    })
    expect(logLines).toEqual([
      expect.objectContaining({
        level: 'info',
        event: 'financing_treatment.undone',
        propertyId: flat,
        from: '2027-01-01',
      }),
    ])
    expect((await view()).treatments).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 'capitalised' },
    ])
  })

  test('Undoing the only treatment', async () => {
    await addFinancingCharge(deps('annika'), flat, {
      name: 'Putkiremontti',
      amount: 8000,
      from: '2025-03-01',
    })
    await treat('capitalised', '2025-03-01')
    expect((await view()).capitalised).toBe(21 * 8000)
    expect(await undoFinancingTreatment(deps('annika'), flat)).toEqual({
      ok: true,
    })
    const seen = await view()
    expect(seen.treatments).toEqual([])
    expect(seen.capitalised).toBe(0)
  })

  test('No treatment to undo is refused', async () => {
    expect(await undoFinancingTreatment(deps('annika'), flat)).toEqual({
      ok: false,
      reason: 'treatment_nothing_to_undo',
    })
    expect(logLines).toEqual([])
  })

  test("A member can't undo the treatment", async () => {
    await treat('capitalised', '2025-03-01')
    expect(await undoFinancingTreatment(deps('jussi'), flat)).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect((await view()).treatments).toHaveLength(1)
  })

  test('someone without access gets "not found"', async () => {
    await treat('capitalised', '2025-03-01')
    expect(await undoFinancingTreatment(deps('liisa'), flat)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })
})

const addCharge = async (
  name: string,
  amount: number,
  from: string,
  userId = 'annika',
  propertyId = flat,
) => addFinancingCharge(deps(userId), propertyId, { name, amount, from })

/** Adds a charge as Annika and returns its id. */
const chargeId = async (name: string, amount: number, from: string) => {
  const added = await addCharge(name, amount, from)
  if (!added.ok) {
    throw new Error(added.reason)
  }
  return added.chargeId
}

const setCharge = (
  id: string,
  amount: number,
  from: string,
  userId = 'annika',
) =>
  setRecurringAmount(deps(userId), flat, {
    kind: 'financing_charge',
    chargeId: id,
    amount,
    from,
  })

const charges = async () => (await view()).financingCharges

/** A second flat of Annika's. */
const otherFlat = async () =>
  (
    await propertyRepository(db).create(
      'annika',
      {
        streetAddress: 'Koivutie 1 A 2',
        postcode: '33100',
        city: 'Tampere',
        roomCount: 1,
        floorArea: 300,
      },
      now,
      '2025-03-01',
    )
  ).id

describe('Adding a financing charge', () => {
  test('Adding a second financing charge', async () => {
    await chargeId('Putkiremontti', 8600, '2025-03-01')
    expect(await addCharge('Julkisivu', 4200, '2026-01-01')).toEqual({
      ok: true,
      chargeId: expect.any(String) as string,
    })
    expect(logLines.at(-1)).toMatchObject({
      level: 'info',
      event: 'financing_charge.added',
      propertyId: flat,
      from: '2026-01-01',
    })
    expect(JSON.stringify(logLines)).not.toContain('Julkisivu')
    expect(
      (await charges()).map(({ name, periods }) => ({ name, periods })),
    ).toEqual([
      {
        name: 'Putkiremontti',
        periods: [{ validFrom: '2025-03-01', validTo: null, value: 8600 }],
      },
      {
        name: 'Julkisivu',
        periods: [{ validFrom: '2026-01-01', validTo: null, value: 4200 }],
      },
    ])
  })

  test('A name already in use is refused', async () => {
    await chargeId('Putkiremontti', 8600, '2025-03-01')
    expect(await addCharge('putkiremontti', 4200, '2026-01-01')).toEqual({
      ok: false,
      reason: 'financing_charge_name_taken',
    })
    expect(await charges()).toHaveLength(1)
  })

  test("A new charge's date before the flat's ownership is refused", async () => {
    expect(await addCharge('Julkisivu', 4200, '2025-01-01')).toEqual({
      ok: false,
      reason: 'amount_date_before_ownership',
    })
    expect(await charges()).toEqual([])
  })

  test("A member can't add a financing charge", async () => {
    expect(await addCharge('Julkisivu', 4200, '2026-01-01', 'jussi')).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect(await charges()).toEqual([])
  })
})

describe('Renaming a financing charge', () => {
  test('Naming the unnamed charge', async () => {
    // The charge the migration made from the previous financing charge.
    await env.DB.prepare(
      'INSERT INTO financing_charges (id, property_id, name) VALUES (?, ?, NULL)',
    )
      .bind('unnamed', flat)
      .run()
    await env.DB.prepare(
      "INSERT INTO recurring_amounts (id, property_id, kind, financing_charge_id, amount, valid_from) VALUES ('p1', ?, 'financing_charge', 'unnamed', 8600, '2025-03-01')",
    )
      .bind(flat)
      .run()
    const unnamed = (await charges()).at(0)
    if (unnamed === undefined) {
      throw new Error('No charge')
    }
    expect(unnamed.name).toBeNull()
    expect(
      await renameFinancingCharge(deps('annika'), flat, {
        chargeId: unnamed.id,
        name: 'Putkiremontti',
      }),
    ).toEqual({ ok: true })
    expect(logLines.at(-1)).toMatchObject({
      event: 'financing_charge.renamed',
      chargeId: unnamed.id,
    })
    expect(await charges()).toEqual([{ ...unnamed, name: 'Putkiremontti' }])
  })

  test('Changing the case of a name', async () => {
    const id = await chargeId('julkisivu', 4200, '2026-01-01')
    expect(
      await renameFinancingCharge(deps('annika'), flat, {
        chargeId: id,
        name: 'Julkisivu',
      }),
    ).toEqual({ ok: true })
    expect((await charges())[0]?.name).toBe('Julkisivu')
  })

  test("another charge's name is taken", async () => {
    await chargeId('Putkiremontti', 8600, '2025-03-01')
    const id = await chargeId('Julkisivu', 4200, '2026-01-01')
    expect(
      await renameFinancingCharge(deps('annika'), flat, {
        chargeId: id,
        name: 'PUTKIREMONTTI',
      }),
    ).toEqual({ ok: false, reason: 'financing_charge_name_taken' })
  })

  test("Another flat's charge is not found", async () => {
    const other = await otherFlat()
    const added = await addCharge('Muu', 1000, '2025-03-01', 'annika', other)
    expect(
      await renameFinancingCharge(deps('annika'), flat, {
        chargeId: added.ok ? added.chargeId : '',
        name: 'Julkisivu',
      }),
    ).toEqual({ ok: false, reason: 'financing_charge_not_found' })
  })

  test("A member can't rename a financing charge", async () => {
    const id = await chargeId('Julkisivu', 4200, '2026-01-01')
    expect(
      await renameFinancingCharge(deps('jussi'), flat, {
        chargeId: id,
        name: 'Hissi',
      }),
    ).toEqual({ ok: false, reason: 'sharing_owner_only' })
  })
})

describe('Financing charges', () => {
  describe('Setting a charge', () => {
    test('Changing one financing charge leaves the others', async () => {
      const putki = await chargeId('Putkiremontti', 8600, '2025-03-01')
      const julkisivu = await chargeId('Julkisivu', 4200, '2026-01-01')
      expect(await setCharge(julkisivu, 4500, '2027-01-01')).toEqual({
        ok: true,
      })
      expect(logLines.at(-1)).toMatchObject({
        event: 'recurring_amount.set',
        kind: 'financing_charge',
        chargeId: julkisivu,
      })
      const after = await charges()
      expect(after.find((charge) => charge.id === putki)?.periods).toEqual([
        { validFrom: '2025-03-01', validTo: null, value: 8600 },
      ])
      expect(after.find((charge) => charge.id === julkisivu)?.periods).toEqual([
        { validFrom: '2026-01-01', validTo: '2026-12-31', value: 4200 },
        { validFrom: '2027-01-01', validTo: null, value: 4500 },
      ])
    })

    test("Another flat's financing charge is not found", async () => {
      const other = await otherFlat()
      const added = await addCharge('Muu', 1000, '2025-03-01', 'annika', other)
      expect(
        await setCharge(added.ok ? added.chargeId : '', 2000, '2026-01-01'),
      ).toEqual({ ok: false, reason: 'financing_charge_not_found' })
    })
  })

  describe('Undoing the latest charge change', () => {
    test("Undoing a financing charge's only amount removes it", async () => {
      const putki = await chargeId('Putkiremontti', 8600, '2025-03-01')
      const julkisivu = await chargeId('Julkisivu', 4200, '2026-01-01')
      expect(
        await undoRecurringAmount(
          deps('annika'),
          flat,
          'financing_charge',
          julkisivu,
        ),
      ).toEqual({ ok: true })
      expect(logLines.map((line) => line.event)).toEqual([
        'recurring_amount.undone',
        'financing_charge.removed',
      ])
      expect((await charges()).map((charge) => charge.id)).toEqual([putki])
    })
  })
})

describe('Ending a financing charge', () => {
  test('Undoing an ending', async () => {
    const hissi = await chargeId('Hissiremontti', 2400, '2025-03-01')
    await setCharge(hissi, 0, '2026-01-01')
    expect(
      await undoRecurringAmount(
        deps('annika'),
        flat,
        'financing_charge',
        hissi,
      ),
    ).toEqual({ ok: true })
    expect((await charges())[0]?.periods).toEqual([
      { validFrom: '2025-03-01', validTo: null, value: 2400 },
    ])
  })
})
