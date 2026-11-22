import { describe, expect, test } from 'vitest'
import type { Period } from '#/features/recurring-amounts/periods'
import {
  expectedRent,
  monthStatus,
  monthsNotFullyPaid,
  rentDueDate,
  rentMonths,
  tenancyMonths,
  type PaymentOfMonth,
  type RentTenancy,
} from './status'

const rent = (
  ...periods: [string, string | null, number][]
): Period<number>[] =>
  periods.map(([validFrom, validTo, value]) => ({ validFrom, validTo, value }))

const aino: RentTenancy = {
  id: 'aino',
  validFrom: '2025-03-01',
  validTo: null,
  dueDay: 5,
}

const pay = (
  month: string,
  amount: number,
  paidOn: string,
  tenancyId = 'aino',
): PaymentOfMonth => ({ tenancyId, month, amount, paidOn })

describe('Expected rent of a month', () => {
  const flat = rent(['2025-03-01', null, 89000])

  test('A full month', () => {
    expect(expectedRent(flat, aino, '2026-11')).toBe(89000)
  })

  test('A tenancy starting mid-month', () => {
    expect(
      expectedRent(flat, { ...aino, validFrom: '2026-11-15' }, '2026-11'),
    ).toBe(47467)
  })

  test('A tenancy ending mid-month', () => {
    expect(
      expectedRent(flat, { ...aino, validTo: '2027-01-14' }, '2027-01'),
    ).toBe(40194)
  })

  test('A rent change during the tenancy', () => {
    const changed = rent(
      ['2025-03-01', '2026-02-28', 89000],
      ['2026-03-01', null, 92000],
    )
    expect(expectedRent(changed, aino, '2026-02')).toBe(89000)
    expect(expectedRent(changed, aino, '2026-03')).toBe(92000)
  })

  test('A tenant change with a new rent mid-month', () => {
    const changed = rent(
      ['2025-03-01', '2026-10-31', 80000],
      ['2026-11-01', null, 90000],
    )
    const outgoing = { ...aino, validTo: '2026-11-14' }
    const incoming = { ...aino, id: 'next', validFrom: '2026-11-15' }
    expect(expectedRent(changed, outgoing, '2026-11')).toBe(42000)
    expect(expectedRent(changed, incoming, '2026-11')).toBe(48000)
  })

  test('No rent set', () => {
    expect(expectedRent([], aino, '2026-11')).toBeUndefined()
    expect(
      monthStatus({
        expected: undefined,
        payments: [pay('2026-11', 89000, '2026-11-03')],
        dueDate: '2026-11-05',
        today: '2026-11-22',
      }),
    ).toEqual({ kind: 'rent_not_set' })
  })

  test('rounds halves up', () => {
    // 1 cent × 15 / 30 = 0,5 → 1
    expect(
      expectedRent(
        rent(['2026-11-01', null, 1]),
        { ...aino, validFrom: '2026-11-16' },
        '2026-11',
      ),
    ).toBe(1)
  })

  test('a tenancy starting and ending in the same month', () => {
    expect(
      expectedRent(
        flat,
        { ...aino, validFrom: '2026-11-10', validTo: '2026-11-19' },
        '2026-11',
      ),
    ).toBe(29667)
  })
})

describe('The rent status of a month', () => {
  const status = (
    payments: PaymentOfMonth[],
    today: string,
    expected = 89000,
    due = '2026-11-05',
  ) => monthStatus({ expected, payments, dueDate: due, today })

  test('Due until the due date', () => {
    expect(status([], '2026-11-05')).toEqual({ kind: 'due', on: '2026-11-05' })
  })

  test('Late from the day after the due date', () => {
    expect(status([], '2026-11-22')).toEqual({ kind: 'late', days: 17 })
  })

  test('Partly paid', () => {
    expect(status([pay('2026-11', 50000, '2026-11-04')], '2026-11-22')).toEqual(
      { kind: 'partly_paid', missing: 39000 },
    )
  })

  test('Paid in two payments', () => {
    expect(
      status(
        [
          pay('2026-11', 50000, '2026-11-04'),
          pay('2026-11', 39000, '2026-11-20'),
        ],
        '2026-11-22',
      ),
    ).toEqual({ kind: 'paid', on: '2026-11-20' })
  })

  test('Paid more than expected', () => {
    expect(
      status([pay('2026-11', 90000, '2026-11-03')], '2026-11-22').kind,
    ).toBe('paid')
  })

  test('A rent of 0 € is never late', () => {
    expect(status([], '2026-11-22', 0)).toEqual({ kind: 'nothing_to_pay' })
    expect(
      monthsNotFullyPaid({
        tenancies: [aino],
        rentPeriods: rent(['2025-03-01', null, 0]),
        payments: [],
        today: '2026-11-22',
      }),
    ).toEqual([])
  })

  test('a payment in a month without rent shows it as paid', () => {
    expect(
      status([pay('2026-11', 100, '2026-11-03')], '2026-11-22', 0),
    ).toEqual({ kind: 'paid', on: '2026-11-03' })
  })

  test('The due date in the first month is no earlier than the start', () => {
    const starting = { ...aino, validFrom: '2026-11-15' }
    const due = rentDueDate(starting, '2026-11')
    expect(due).toBe('2026-11-15')
    expect(status([], '2026-11-10', 47467, due).kind).toBe('due')
    expect(status([], '2026-11-16', 47467, due)).toEqual({
      kind: 'late',
      days: 1,
    })
  })

  test('The due day in a shorter month', () => {
    expect(rentDueDate({ ...aino, dueDay: 31 }, '2027-02')).toBe('2027-02-28')
  })
})

describe('Months not fully paid', () => {
  const flat = rent(['2023-01-01', null, 89000])

  test('Earlier months of this and last year count', () => {
    const months = monthsNotFullyPaid({
      tenancies: [aino],
      rentPeriods: flat,
      payments: rentPaidThrough('2025-11'),
      today: '2026-01-20',
    })
    expect(months.map((row) => row.month)).toEqual(['2026-01', '2025-12'])
  })

  test("Months two years back don't count", () => {
    const old: RentTenancy = {
      id: 'pekka',
      validFrom: '2023-01-01',
      validTo: '2024-12-31',
      dueDay: 5,
    }
    expect(
      monthsNotFullyPaid({
        tenancies: [old],
        rentPeriods: flat,
        payments: [],
        today: '2026-11-22',
      }),
    ).toEqual([])
  })

  test("A month before its due date doesn't count", () => {
    const months = monthsNotFullyPaid({
      tenancies: [aino],
      rentPeriods: flat,
      payments: rentPaidThrough('2026-10'),
      today: '2026-11-03',
    })
    expect(months).toEqual([])
  })

  test('a partly paid month counts, a month without a rent does not', () => {
    const months = monthsNotFullyPaid({
      tenancies: [aino],
      rentPeriods: rent(['2025-03-01', '2026-09-30', 89000]),
      payments: [
        ...rentPaidThrough('2026-08'),
        pay('2026-09', 50000, '2026-09-04'),
      ],
      today: '2026-11-22',
    })
    expect(months.map((row) => [row.month, row.status.kind])).toEqual([
      ['2026-09', 'partly_paid'],
    ])
  })
})

describe('Months of a tenancy', () => {
  test('lists the months a tenancy runs in, clipped to the range', () => {
    expect(
      tenancyMonths(
        { ...aino, validFrom: '2025-11-15', validTo: '2026-02-14' },
        '2025-01',
        '2026-12',
      ),
    ).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(tenancyMonths(aino, '2026-10', '2026-11')).toEqual([
      '2026-10',
      '2026-11',
    ])
  })

  test('two tenancies in one month give two rows, newest month first', () => {
    const pekka: RentTenancy = {
      id: 'pekka',
      validFrom: '2024-06-01',
      validTo: '2025-02-14',
      dueDay: 1,
    }
    const ainoFromMid = { ...aino, validFrom: '2025-02-15' }
    const rows = rentMonths({
      tenancies: [pekka, ainoFromMid],
      rentPeriods: rent(['2024-06-01', null, 89000]),
      payments: [],
      from: '2025-01',
      to: '2025-03',
      today: '2025-03-20',
    })
    expect(rows.map((row) => [row.month, row.tenancy.id])).toEqual([
      ['2025-03', 'aino'],
      ['2025-02', 'aino'],
      ['2025-02', 'pekka'],
      ['2025-01', 'pekka'],
    ])
    expect(rows[1]?.expected).toBe(44500)
    expect(rows[1]?.missing).toBe(44500)
  })
})

/** Every month of `aino` from her start through `last`, paid on the 3rd. */
function rentPaidThrough(last: string): PaymentOfMonth[] {
  return tenancyMonths(aino, '2025-03', last).map((month) =>
    pay(month, 89000, `${month}-03`),
  )
}
