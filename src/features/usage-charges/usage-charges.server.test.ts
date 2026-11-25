import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { tenancyRepository } from '#/features/tenancies/tenancy.repository.server'
import { createDb } from '#/server/platform/db.server'
import { createCaptureLogger } from '#/server/platform/logger.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { addUsageChargeInput } from './schemas'
import { usageChargeRepository } from './usage-charge.repository.server'
import {
  addUsageCharge,
  getUsageCharges,
  setUsageCharge,
  undoUsageCharge,
  type UsageChargeDeps,
} from './usage-charges.server'

const db = createDb(env.DB)
const now = new Date(Date.UTC(2026, 10, 24, 10, 0, 0))
let capture = createCaptureLogger()
let flat = ''
let other = ''

function deps(userId = 'annika'): UsageChargeDeps {
  return {
    userId,
    charges: usageChargeRepository(db),
    tenancies: tenancyRepository(db),
    properties: propertyRepository(db),
    ownership: ownershipRepository(db),
    sharing: sharingRepository(db),
    log: capture.log,
    now: () => now,
  }
}

const details = {
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2 as const,
  floorArea: 485,
}

beforeEach(async () => {
  capture = createCaptureLogger()
  await emptyTables(
    'usage_charge_amounts',
    'usage_charges',
    'tenancy_occupants',
    'tenancies',
    'ownership_periods',
    'property_access',
    'properties',
    'user',
  )
  await addTestUser('annika')
  await addTestUser('jussi')
  await addTestUser('stranger')
  flat = (
    await propertyRepository(db).create('annika', details, now, '2025-03-01')
  ).id
  other = (
    await propertyRepository(db).create('annika', details, now, '2025-03-01')
  ).id
  await env.DB.prepare(
    "INSERT INTO property_access (property_id, user_id, role, created_at) VALUES (?, 'jussi', 'member', ?)",
  )
    .bind(flat, now.getTime())
    .run()
})

const water = {
  kind: 'water',
  basis: 'per_occupant',
  description: null,
  amount: 2200,
  from: '2026-01-01',
} as const

async function chargesOf(propertyId = flat) {
  return usageChargeRepository(db).forProperty(propertyId)
}

async function addWater() {
  const result = await addUsageCharge(deps(), flat, water)
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result.chargeId
}

describe('Usage charges are recorded as monthly periods', () => {
  test('Other needs a description', async () => {
    expect(
      await addUsageCharge(deps(), flat, {
        ...water,
        kind: 'other',
        basis: 'fixed',
        description: '  ',
      }),
    ).toEqual({ ok: false, reason: 'description_required' })
    expect(await chargesOf()).toEqual([])
  })

  test('Two parking spaces are two usage charges', async () => {
    const parking = { ...water, kind: 'parking', basis: 'fixed' } as const
    await addUsageCharge(deps(), flat, { ...parking, amount: 1500 })
    await addUsageCharge(deps(), flat, { ...parking, amount: 2500 })
    expect((await chargesOf()).map((c) => c.periods[0]?.value).sort()).toEqual([
      1500, 2500,
    ])
  })

  test("A usage charge's date that isn't the first of a month is refused", async () => {
    expect(
      await addUsageCharge(deps(), flat, { ...water, from: '2026-01-15' }),
    ).toEqual({ ok: false, reason: 'amount_date_not_month_start' })
    expect(
      addUsageChargeInput.safeParse({
        propertyId: flat,
        kind: 'water',
        basis: 'per_occupant',
        description: '',
        amount: '22',
        from: '15.1.2026',
      }).error?.issues[0]?.message,
    ).toBe('amount_date_not_month_start')
    expect(await chargesOf()).toEqual([])
  })

  test('An invalid usage charge amount is refused', () => {
    for (const amount of ['-5', '100000', '12,345']) {
      expect(
        addUsageChargeInput.safeParse({
          propertyId: flat,
          kind: 'water',
          basis: 'per_occupant',
          description: '',
          amount,
          from: '1.1.2026',
        }).error?.issues[0]?.message,
      ).toBe('amount_invalid')
    }
  })
})

describe('The usage charges page', () => {
  test('gives everyone with access the charges and the tenancies with their occupants', async () => {
    await addWater()
    const view = await getUsageCharges(deps('jussi'), flat)
    expect(view).toMatchObject({
      ok: true,
      role: 'member',
      today: '2026-11-24',
      ownershipStart: '2025-03-01',
      tenancies: [],
    })
    expect(view.ok && view.charges).toHaveLength(1)
  })

  test("Another user can't open the usage charges page", async () => {
    expect(await getUsageCharges(deps('stranger'), flat)).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
  })
})

describe('Adding a usage charge', () => {
  test('Adding the water charge per occupant', async () => {
    const id = await addWater()
    expect(await chargesOf()).toEqual([
      expect.objectContaining({
        id,
        kind: 'water',
        basis: 'per_occupant',
        periods: [{ validFrom: '2026-01-01', validTo: null, value: 2200 }],
      }),
    ])
    expect(capture.lines.at(-1)).toMatchObject({
      event: 'usage_charge.added',
      propertyId: flat,
      usageChargeId: id,
    })
    expect(JSON.stringify(capture.lines.at(-1))).not.toMatch(
      /(?<![\w-])2200(?![\w-])/,
    )
  })

  test('Other with a description', async () => {
    await addUsageCharge(deps(), flat, {
      ...water,
      kind: 'other',
      basis: 'fixed',
      description: ' Pyykkitupa ',
      amount: 1000,
    })
    expect((await chargesOf())[0]?.description).toBe('Pyykkitupa')
  })

  test("A usage charge's date before the flat's ownership is refused", async () => {
    expect(
      await addUsageCharge(deps(), flat, { ...water, from: '2025-01-01' }),
    ).toEqual({ ok: false, reason: 'amount_date_before_ownership' })
    expect(await chargesOf()).toEqual([])
  })

  test("A member can't add a usage charge", async () => {
    expect(await addUsageCharge(deps('jussi'), flat, water)).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect(await chargesOf()).toEqual([])
  })
})

describe('Changing a usage charge', () => {
  test('Raising the water charge from next year', async () => {
    const id = await addWater()
    expect(
      await setUsageCharge(deps(), flat, id, {
        amount: 2400,
        from: '2027-01-01',
      }),
    ).toEqual({ ok: true })
    expect((await chargesOf())[0]?.periods).toEqual([
      { validFrom: '2026-01-01', validTo: '2026-12-31', value: 2200 },
      { validFrom: '2027-01-01', validTo: null, value: 2400 },
    ])
    expect(capture.lines.at(-1)).toMatchObject({
      event: 'usage_charge.amount_set',
    })
  })

  test('Ending a parking space', async () => {
    const added = await addUsageCharge(deps(), flat, {
      ...water,
      kind: 'parking',
      basis: 'fixed',
      amount: 1500,
      from: '2026-02-01',
    })
    const id = added.ok ? added.chargeId : ''
    await setUsageCharge(deps(), flat, id, { amount: 0, from: '2027-03-01' })
    expect((await chargesOf())[0]?.periods.at(-1)).toEqual({
      validFrom: '2027-03-01',
      validTo: null,
      value: 0,
    })
  })

  test('An amount on the latest start corrects it', async () => {
    const id = await addWater()
    await setUsageCharge(deps(), flat, id, { amount: 2400, from: '2027-01-01' })
    await setUsageCharge(deps(), flat, id, { amount: 2500, from: '2027-01-01' })
    expect((await chargesOf())[0]?.periods.at(-1)).toEqual({
      validFrom: '2027-01-01',
      validTo: null,
      value: 2500,
    })
    expect(capture.lines.at(-1)).toMatchObject({
      event: 'usage_charge.amount_corrected',
    })
  })

  test('A usage charge date before the latest change is refused', async () => {
    const id = await addWater()
    expect(
      await setUsageCharge(deps(), flat, id, {
        amount: 2400,
        from: '2025-06-01',
      }),
    ).toEqual({ ok: false, reason: 'amount_date_too_early' })
  })

  test("Another flat's usage charge is not found", async () => {
    const id = await addWater()
    expect(
      await setUsageCharge(deps(), other, id, {
        amount: 2400,
        from: '2027-01-01',
      }),
    ).toEqual({ ok: false, reason: 'usage_charge_not_found' })
  })

  test("A member can't change a usage charge", async () => {
    const id = await addWater()
    expect(
      await setUsageCharge(deps('jussi'), flat, id, {
        amount: 2400,
        from: '2027-01-01',
      }),
    ).toEqual({ ok: false, reason: 'sharing_owner_only' })
    expect((await chargesOf())[0]?.periods).toHaveLength(1)
  })
})

describe('Undoing the latest usage charge change', () => {
  test('Undoing a usage charge increase', async () => {
    const id = await addWater()
    await setUsageCharge(deps(), flat, id, { amount: 2400, from: '2027-01-01' })
    expect(await undoUsageCharge(deps(), flat, id)).toEqual({ ok: true })
    expect((await chargesOf())[0]?.periods).toEqual([
      { validFrom: '2026-01-01', validTo: null, value: 2200 },
    ])
    expect(capture.lines.at(-1)).toMatchObject({
      event: 'usage_charge.change_undone',
    })
  })

  test('Undoing the only amount removes the usage charge', async () => {
    const kept = await addWater()
    const sauna = await addUsageCharge(deps(), flat, {
      ...water,
      kind: 'sauna',
      basis: 'fixed',
      amount: 1200,
    })
    expect(
      await undoUsageCharge(deps(), flat, sauna.ok ? sauna.chargeId : ''),
    ).toEqual({ ok: true })
    expect((await chargesOf()).map((c) => c.id)).toEqual([kept])
    expect(capture.lines.at(-1)).toMatchObject({
      event: 'usage_charge.removed',
    })
  })

  test("A member can't undo a usage charge change", async () => {
    const id = await addWater()
    expect(await undoUsageCharge(deps('jussi'), flat, id)).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect(await chargesOf()).toHaveLength(1)
  })
})
