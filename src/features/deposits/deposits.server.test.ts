import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, test } from 'vitest'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { rentPaymentRepository } from '#/features/rent-payments/rent-payment.repository.server'
import { deleteRentPayment } from '#/features/rent-payments/rent-payments.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import {
  tenancyRepository,
  type TenancyFields,
} from '#/features/tenancies/tenancy.repository.server'
import { createDb } from '#/server/platform/db.server'
import { createCaptureLogger } from '#/server/platform/logger.server'
import { addTestUser, emptyTables } from '#/test/users.server'
import { depositReturnRepository } from './deposit-return.repository.server'
import {
  deleteDepositReturn,
  getDepositReturn,
  recordDepositReturn,
  updateDepositReturn,
  type DepositDeps,
  type ReturnInputFields,
} from './deposits.server'

const db = createDb(env.DB)
// 15 January 2027 at noon in Finland.
let now = new Date(Date.UTC(2027, 0, 15, 10, 0, 0))
let flat = ''
let tenancy = ''
let capture = createCaptureLogger()

function deps(userId = 'annika'): DepositDeps {
  return {
    userId,
    deposits: depositReturnRepository(db),
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
  contractMade: '2026-09-12',
  validFrom: '2026-10-01',
  termEnd: null,
  dueDay: 5,
  deposit: 178000,
}

const ended = {
  noticeGivenBy: 'tenant' as const,
  noticeDate: '2026-11-20',
  lastDay: '2026-12-31',
}

const full: ReturnInputFields = {
  returnedOn: '2027-01-15',
  deductions: false,
  rentKept: 0,
  damageKept: 0,
  note: null,
}

const withDeductions = (
  rentKept: number,
  damageKept: number,
  note: string | null = null,
): ReturnInputFields => ({
  ...full,
  deductions: true,
  rentKept,
  damageKept,
  note,
})

async function addTenancy(fields: TenancyFields, ending = ended) {
  const result = await tenancyRepository(db).createWithRent(
    'annika',
    flat,
    fields,
    89000,
    now,
    ending,
  )
  if (result.outcome !== 'created') {
    throw new Error('the tenancy was not created')
  }
  return result.id
}

async function pay(month: string, amount: number) {
  await rentPaymentRepository(db).record(
    'annika',
    flat,
    { tenancyId: tenancy, month, amount, paidOn: `${month}-04` },
    now,
  )
}

/** October and November paid; December `paid` of 89000 cents. */
async function paidUntilDecember(paid: number) {
  await pay('2026-10', 89000)
  await pay('2026-11', 89000)
  if (paid > 0) {
    await pay('2026-12', paid)
  }
}

async function payments() {
  return (await rentPaymentRepository(db).forProperty(flat)).map((p) => [
    p.month,
    p.amount,
    p.paidOn,
    p.depositReturnId !== null,
  ])
}

async function view(userId = 'annika') {
  const result = await getDepositReturn(deps(userId), flat, tenancy)
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result
}

beforeEach(async () => {
  now = new Date(Date.UTC(2027, 0, 15, 10, 0, 0))
  capture = createCaptureLogger()
  await emptyTables(
    'rent_payments',
    'deposit_returns',
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
  tenancy = await addTenancy(aino)
})

describe('Recording a deposit return', () => {
  test('Returning a deposit in full', async () => {
    await paidUntilDecember(89000)
    const result = await recordDepositReturn(deps(), flat, tenancy, full)
    expect(result.ok).toBe(true)
    expect((await view()).depositReturn).toMatchObject({
      returnedOn: '2027-01-15',
      rentKept: 0,
      damageKept: 0,
    })
    expect(await payments()).toHaveLength(3)
  })

  test('Returning with deductions', async () => {
    await paidUntilDecember(59000)
    expect((await view()).missing).toEqual([
      { month: '2026-12', missing: 30000 },
    ])
    const result = await recordDepositReturn(
      deps(),
      flat,
      tenancy,
      withDeductions(30000, 20000, 'Lattian korjaus'),
    )
    expect(result.ok).toBe(true)
    expect((await view()).depositReturn).toMatchObject({
      rentKept: 30000,
      damageKept: 20000,
      note: 'Lattian korjaus',
    })
  })

  test("Deductions can't exceed the deposit", async () => {
    await paidUntilDecember(0)
    expect(
      await recordDepositReturn(
        deps(),
        flat,
        tenancy,
        withDeductions(100000, 90000),
      ),
    ).toEqual({ ok: false, reason: 'deposit_kept_exceeds_deposit' })
    expect((await view()).depositReturn).toBeUndefined()
  })

  test('Deductions need an amount', async () => {
    expect(
      await recordDepositReturn(deps(), flat, tenancy, withDeductions(0, 0)),
    ).toEqual({ ok: false, reason: 'deposit_kept_required' })
    expect((await view()).depositReturn).toBeUndefined()
  })

  test('A return before the last rent day is refused', async () => {
    expect(
      await recordDepositReturn(deps(), flat, tenancy, {
        ...full,
        returnedOn: '2026-12-30',
      }),
    ).toEqual({ ok: false, reason: 'deposit_return_before_end' })
    expect((await view()).depositReturn).toBeUndefined()
  })

  test('A return date in the future is refused', async () => {
    expect(
      await recordDepositReturn(deps(), flat, tenancy, {
        ...full,
        returnedOn: '2027-01-16',
      }),
    ).toEqual({ ok: false, reason: 'deposit_return_date_in_future' })
  })

  test('A tenancy without a deposit has no return', async () => {
    const other = await addTenancy(
      { ...aino, deposit: null, validFrom: '2025-04-01' },
      { ...ended, lastDay: '2025-06-30', noticeDate: '2025-05-01' },
    )
    expect(await recordDepositReturn(deps(), flat, other, full)).toEqual({
      ok: false,
      reason: 'deposit_not_set',
    })
  })

  test('A second return is refused', async () => {
    await paidUntilDecember(89000)
    await recordDepositReturn(deps(), flat, tenancy, withDeductions(0, 5000))
    expect(
      await recordDepositReturn(deps(), flat, tenancy, withDeductions(0, 9000)),
    ).toEqual({ ok: false, reason: 'deposit_return_exists' })
    expect((await view()).depositReturn?.damageKept).toBe(5000)
  })

  test("A member can't record a return", async () => {
    expect(
      await recordDepositReturn(deps('jussi'), flat, tenancy, full),
    ).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect(
      await recordDepositReturn(deps('stranger'), flat, tenancy, full),
    ).toEqual({
      ok: false,
      reason: 'property_not_found',
    })
    expect((await view()).depositReturn).toBeUndefined()
  })

  test('a tenancy of another flat is refused as not found', async () => {
    expect(await recordDepositReturn(deps(), flat, 'nope', full)).toEqual({
      ok: false,
      reason: 'tenancy_not_found',
    })
  })

  test('logs the return without amounts', async () => {
    await paidUntilDecember(59000)
    await recordDepositReturn(deps(), flat, tenancy, withDeductions(30000, 0))
    const line = capture.lines.find(
      (l) => l.event === 'deposit.return_recorded',
    )
    expect(line).toMatchObject({ propertyId: flat, tenancyId: tenancy })
    expect(JSON.stringify(capture.lines)).not.toContain('30000')
  })
})

describe('Rent kept from the deposit', () => {
  test('The rent kept pays the missing month', async () => {
    await paidUntilDecember(59000)
    await recordDepositReturn(deps(), flat, tenancy, withDeductions(30000, 0))
    expect(await payments()).toEqual(
      [
        ['2026-10', 89000, '2026-10-04', false],
        ['2026-11', 89000, '2026-11-04', false],
        ['2026-12', 30000, '2027-01-15', true],
        ['2026-12', 59000, '2026-12-04', false],
      ].sort(
        (a, b) =>
          String(a[0]).localeCompare(String(b[0])) ||
          String(a[2]).localeCompare(String(b[2])),
      ),
    )
  })

  test('The rent kept covers the oldest months first', async () => {
    await pay('2026-10', 89000)
    await pay('2026-11', 79000)
    await pay('2026-12', 59000)
    await recordDepositReturn(deps(), flat, tenancy, withDeductions(35000, 0))
    const kept = (await payments()).filter((p) => p[3])
    expect(kept).toEqual([
      ['2026-11', 10000, '2027-01-15', true],
      ['2026-12', 25000, '2027-01-15', true],
    ])
  })

  test("The rent kept can't exceed the rent missing", async () => {
    await paidUntilDecember(59000)
    expect(
      await recordDepositReturn(
        deps(),
        flat,
        tenancy,
        withDeductions(40000, 0),
      ),
    ).toEqual({ ok: false, reason: 'deposit_rent_exceeds_unpaid' })
    expect(await payments()).toHaveLength(3)
  })
})

describe('Correcting and deleting a deposit return', () => {
  beforeEach(async () => {
    await paidUntilDecember(59000)
    await recordDepositReturn(
      deps(),
      flat,
      tenancy,
      withDeductions(30000, 20000),
    )
  })

  test('Correcting the amount kept for damage', async () => {
    expect(
      await updateDepositReturn(
        deps(),
        flat,
        tenancy,
        withDeductions(30000, 15000),
      ),
    ).toEqual({ ok: true })
    expect((await view()).depositReturn).toMatchObject({
      rentKept: 30000,
      damageKept: 15000,
    })
    expect((await payments()).filter((p) => p[3])).toEqual([
      ['2026-12', 30000, '2027-01-15', true],
    ])
  })

  test('Correcting the rent kept replaces its payments', async () => {
    expect(
      await updateDepositReturn(
        deps(),
        flat,
        tenancy,
        withDeductions(10000, 20000),
      ),
    ).toEqual({ ok: true })
    expect((await payments()).filter((p) => p[3])).toEqual([
      ['2026-12', 10000, '2027-01-15', true],
    ])
  })

  test('Deleting a return removes its payments', async () => {
    expect(await deleteDepositReturn(deps(), flat, tenancy)).toEqual({
      ok: true,
    })
    const after = await view()
    expect(after.depositReturn).toBeUndefined()
    expect(after.missing).toEqual([{ month: '2026-12', missing: 30000 }])
    expect((await payments()).filter((p) => p[3])).toEqual([])
    expect(capture.lines.map((l) => l.event)).toContain(
      'deposit.return_deleted',
    )
  })

  test("A member can't delete a return", async () => {
    expect(await deleteDepositReturn(deps('jussi'), flat, tenancy)).toEqual({
      ok: false,
      reason: 'sharing_owner_only',
    })
    expect(
      await updateDepositReturn(
        deps('jussi'),
        flat,
        tenancy,
        withDeductions(0, 100),
      ),
    ).toEqual({ ok: false, reason: 'sharing_owner_only' })
    expect((await view()).depositReturn).toBeDefined()
  })

  test('a correction is checked like a new return', async () => {
    expect(
      await updateDepositReturn(
        deps(),
        flat,
        tenancy,
        withDeductions(40000, 0),
      ),
    ).toEqual({ ok: false, reason: 'deposit_rent_exceeds_unpaid' })
    expect(
      await updateDepositReturn(deps(), flat, tenancy, {
        ...withDeductions(30000, 20000),
        returnedOn: '2026-12-01',
      }),
    ).toEqual({ ok: false, reason: 'deposit_return_before_end' })
  })
})

describe('A payment from the deposit', () => {
  test("A payment from the deposit can't be deleted on its own", async () => {
    await paidUntilDecember(59000)
    await recordDepositReturn(deps(), flat, tenancy, withDeductions(30000, 0))
    const kept = (await rentPaymentRepository(db).forProperty(flat)).find(
      (p) => p.depositReturnId !== null,
    )
    expect(
      await deleteRentPayment(
        {
          userId: 'annika',
          payments: rentPaymentRepository(db),
          tenancies: tenancyRepository(db),
          properties: propertyRepository(db),
          sharing: sharingRepository(db),
          log: capture.log,
          now: () => now,
        },
        flat,
        kept?.id ?? '',
      ),
    ).toEqual({ ok: false, reason: 'rent_payment_from_deposit' })
    expect((await payments()).filter((p) => p[3])).toHaveLength(1)
  })
})
