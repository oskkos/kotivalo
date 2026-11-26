import { describe, expect, test } from 'vitest'
import type { PaymentOfMonth } from '#/features/rent-payments/status'
import {
  allocateRentKept,
  amountReturned,
  checkReturn,
  depositOverLimit,
  missingRent,
  pendingReturns,
  returnDeadline,
  type ReturnInput,
} from './deposit'

const aino = {
  id: 'aino',
  validFrom: '2026-10-01',
  validTo: '2026-12-31',
  dueDay: 5,
}

const rents = {
  aino: [{ validFrom: '2026-10-01', validTo: null, value: 89000 }],
}

const pay = (month: string, amount: number): PaymentOfMonth => ({
  tenancyId: 'aino',
  month,
  amount,
  paidOn: `${month}-04`,
})

describe('Rent kept from the deposit', () => {
  test('The rent kept pays the missing month', () => {
    const months = missingRent(aino, {
      rents,
      payments: [
        pay('2026-10', 89000),
        pay('2026-11', 89000),
        pay('2026-12', 59000),
      ],
    })
    expect(months).toEqual([{ month: '2026-12', missing: 30000 }])
    expect(allocateRentKept(months, 30000)).toEqual({
      ok: true,
      payments: [{ month: '2026-12', amount: 30000 }],
    })
  })

  test('The rent kept covers the oldest months first', () => {
    const months = missingRent(aino, {
      rents,
      payments: [
        pay('2026-10', 89000),
        pay('2026-11', 79000),
        pay('2026-12', 59000),
      ],
    })
    expect(months).toEqual([
      { month: '2026-11', missing: 10000 },
      { month: '2026-12', missing: 30000 },
    ])
    expect(allocateRentKept(months, 35000)).toEqual({
      ok: true,
      payments: [
        { month: '2026-11', amount: 10000 },
        { month: '2026-12', amount: 25000 },
      ],
    })
  })

  test("The rent kept can't exceed the rent missing", () => {
    const months = [{ month: '2026-12', missing: 30000 }]
    expect(allocateRentKept(months, 40000)).toEqual({
      ok: false,
      reason: 'deposit_rent_exceeds_unpaid',
    })
  })

  test('nothing kept allocates nothing, and months with no rent set are not missing', () => {
    expect(allocateRentKept([{ month: '2026-12', missing: 100 }], 0)).toEqual({
      ok: true,
      payments: [],
    })
    expect(missingRent(aino, { rents: {}, payments: [] })).toEqual([])
  })

  test('all of the tenancy counts, a part month by its days', () => {
    const months = missingRent(
      { ...aino, validFrom: '2026-12-16', validTo: '2026-12-31' },
      { rents, payments: [] },
    )
    expect(months).toEqual([{ month: '2026-12', missing: 45935 }])
  })
})

describe('Recording a deposit return', () => {
  const base: ReturnInput = {
    deposit: 178000,
    lastRentDay: '2026-12-31',
    hasReturn: false,
    returnedOn: '2027-01-15',
    deductions: true,
    rentKept: 30000,
    damageKept: 20000,
    note: null,
    today: '2027-01-15',
  }

  test('a valid return passes, and the amount returned is computed', () => {
    expect(checkReturn(base)).toBeNull()
    expect(amountReturned(178000, base)).toBe(128000)
    expect(amountReturned(178000, { rentKept: 0, damageKept: 0 })).toBe(178000)
  })

  test("Deductions can't exceed the deposit", () => {
    expect(checkReturn({ ...base, rentKept: 100000, damageKept: 90000 })).toBe(
      'deposit_kept_exceeds_deposit',
    )
  })

  test('Deductions need an amount', () => {
    expect(checkReturn({ ...base, rentKept: 0, damageKept: 0 })).toBe(
      'deposit_kept_required',
    )
    expect(
      checkReturn({ ...base, deductions: false, rentKept: 0, damageKept: 0 }),
    ).toBeNull()
  })

  test('A return before the last rent day is refused', () => {
    expect(checkReturn({ ...base, returnedOn: '2026-12-30' })).toBe(
      'deposit_return_before_end',
    )
    expect(checkReturn({ ...base, returnedOn: '2026-12-31' })).toBeNull()
  })

  test('A return date in the future is refused', () => {
    expect(checkReturn({ ...base, returnedOn: '2027-01-16' })).toBe(
      'deposit_return_date_in_future',
    )
  })

  test('A tenancy without a deposit has no return', () => {
    expect(checkReturn({ ...base, deposit: null })).toBe('deposit_not_set')
    expect(checkReturn({ ...base, lastRentDay: null })).toBe('deposit_not_set')
  })

  test('A second return is refused', () => {
    expect(checkReturn({ ...base, hasReturn: true })).toBe(
      'deposit_return_exists',
    )
  })

  test('a note over 200 characters is refused', () => {
    expect(checkReturn({ ...base, note: 'a'.repeat(200) })).toBeNull()
    expect(checkReturn({ ...base, note: 'a'.repeat(201) })).toBe(
      'deposit_note_too_long',
    )
  })
})

describe("A deposit over three months' rent is warned about", () => {
  test('the limit is three months of the rent', () => {
    expect(depositOverLimit(300000, 89000)).toBe(267000)
    expect(depositOverLimit(267000, 89000)).toBeNull()
    expect(depositOverLimit(178000, 89000)).toBeNull()
  })
})

describe('The deposit return reminder', () => {
  const tenancy = (
    id: string,
    validTo: string | null,
    deposit: number | null,
  ) => ({
    id,
    validTo,
    deposit,
  })

  test('The reminder after the last rent day', () => {
    const list = [tenancy('aino', '2026-12-31', 178000)]
    expect(pendingReturns(list, new Set(), '2027-01-10')).toEqual(list)
    expect(pendingReturns(list, new Set(), '2026-12-31')).toEqual(list)
    expect(returnDeadline('2026-12-31')).toBe('2027-01-14')
  })

  test('No reminder before the last rent day', () => {
    const list = [tenancy('aino', '2026-12-31', 178000)]
    expect(pendingReturns(list, new Set(), '2026-12-30')).toEqual([])
    expect(
      pendingReturns([tenancy('x', null, 178000)], new Set(), '2027-01-10'),
    ).toEqual([])
  })

  test('A tenancy without a deposit has no reminder', () => {
    expect(
      pendingReturns(
        [tenancy('pekka', '2025-02-28', null)],
        new Set(),
        '2027-01-10',
      ),
    ).toEqual([])
  })

  test('a returned tenancy has none, and the order is kept', () => {
    const list = [
      tenancy('a', '2025-01-31', 100000),
      tenancy('b', '2026-01-31', 100000),
    ]
    expect(pendingReturns(list, new Set(['a']), '2027-01-10')).toEqual([
      list[1],
    ])
  })
})
