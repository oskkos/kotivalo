import { describe, expect, test } from 'vitest'
import type { Period } from '#/features/recurring-amounts/periods'
import type { FeeOfTenancy } from '#/features/tenancies/fees'
import {
  expectedRent,
  monthStatus,
  monthsNotFullyPaid,
  rentDueDate,
  rentMonths,
  rentThisMonth,
  tenancyMonths,
  type FlatRentData,
  type PaymentOfMonth,
  type RentTenancy,
} from './status'

const rent = (
  ...periods: [string, string | null, number][]
): Period<number>[] =>
  periods.map(([validFrom, validTo, value]) => ({ validFrom, validTo, value }))

/** The month's expected rent of a tenancy with a rent only. */
const expectedTotal = (
  rents: Period<number>[],
  tenancy: RentTenancy,
  month: string,
): number | undefined =>
  expectedRent({ rent: rents, occupants: [], fees: [] }, tenancy, month)?.total

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
    expect(expectedTotal(flat, aino, '2026-11')).toBe(89000)
  })

  test('A tenancy starting mid-month', () => {
    expect(
      expectedTotal(flat, { ...aino, validFrom: '2026-11-15' }, '2026-11'),
    ).toBe(47467)
  })

  test('A tenancy ending mid-month', () => {
    expect(
      expectedTotal(flat, { ...aino, validTo: '2027-01-14' }, '2027-01'),
    ).toBe(40194)
  })

  test('A rent change during the tenancy', () => {
    const changed = rent(
      ['2025-03-01', '2026-02-28', 89000],
      ['2026-03-01', null, 92000],
    )
    expect(expectedTotal(changed, aino, '2026-02')).toBe(89000)
    expect(expectedTotal(changed, aino, '2026-03')).toBe(92000)
  })

  test('A tenant change with a new rent mid-month', () => {
    const outgoing = { ...aino, validTo: '2026-11-14' }
    const incoming = { ...aino, id: 'next', validFrom: '2026-11-15' }
    expect(
      expectedTotal(rent(['2025-03-01', null, 80000]), outgoing, '2026-11'),
    ).toBe(37333)
    expect(
      expectedTotal(rent(['2026-11-15', null, 90000]), incoming, '2026-11'),
    ).toBe(48000)
  })

  test('No rent set', () => {
    expect(expectedTotal([], aino, '2026-11')).toBeUndefined()
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
      expectedTotal(
        rent(['2026-11-01', null, 1]),
        { ...aino, validFrom: '2026-11-16' },
        '2026-11',
      ),
    ).toBe(1)
  })

  test('a tenancy starting and ending in the same month', () => {
    expect(
      expectedTotal(
        flat,
        { ...aino, validFrom: '2026-11-10', validTo: '2026-11-19' },
        '2026-11',
      ),
    ).toBe(29667)
  })
})

describe('with the tenant fees', () => {
  describe('Expected rent of a month', () => {
    const water: FeeOfTenancy = {
      id: 'water',
      kind: 'water',
      basis: 'per_occupant',
      description: null,
      amounts: rent(['2025-03-01', null, 2200]),
    }
    const parking: FeeOfTenancy = {
      id: 'parking',
      kind: 'parking',
      basis: 'fixed',
      description: null,
      amounts: rent(['2025-03-01', null, 1500]),
    }
    const amounts = (
      fees: FeeOfTenancy[],
      occupants = rent(['2025-03-01', null, 2]),
      rents = rent(['2025-03-01', null, 89000]),
    ) => ({ rent: rents, occupants, fees })

    test('The rent with the tenant fees', () => {
      const expected = expectedRent(amounts([water, parking]), aino, '2026-11')
      expect(expected?.total).toBe(94900)
      expect(expected?.parts).toEqual([
        { type: 'rent', amount: 89000 },
        {
          type: 'fee',
          feeId: 'water',
          kind: 'water',
          description: null,
          persons: 2,
          amount: 4400,
        },
        {
          type: 'fee',
          feeId: 'parking',
          kind: 'parking',
          description: null,
          persons: null,
          amount: 1500,
        },
      ])
    })

    test('Fees by days in a partial month', () => {
      const started = expectedRent(
        amounts(
          [{ ...water, amounts: rent(['2026-11-15', null, 2200]) }],
          rent(['2026-11-15', null, 1]),
          rent(['2026-11-15', null, 89000]),
        ),
        { ...aino, validFrom: '2026-11-15' },
        '2026-11',
      )
      expect(started?.total).toBe(48640)
      expect(started?.parts.map((part) => part.amount)).toEqual([47467, 1173])
    })

    test('Fees without a rent', () => {
      expect(
        expectedRent(amounts([parking], [], []), aino, '2026-11'),
      ).toBeNull()
      const [row] = rentMonths({
        tenancies: [aino],
        rents: {},
        fees: { aino: [parking] },
        payments: [],
        from: '2026-11',
        to: '2026-11',
        today: '2026-11-22',
      })
      expect(row.status).toEqual({ kind: 'rent_not_set' })
    })

    test('an ended fee and a fee not yet started add nothing', () => {
      const ended = {
        ...parking,
        amounts: rent(
          ['2025-03-01', '2026-10-31', 1500],
          ['2026-11-01', null, 0],
        ),
      }
      const later = { ...parking, amounts: rent(['2027-01-01', null, 1500]) }
      expect(
        expectedRent(amounts([ended, later]), aino, '2026-11')?.parts,
      ).toEqual([{ type: 'rent', amount: 89000 }])
    })

    test('the status reads the total', () => {
      const [row] = rentMonths({
        tenancies: [aino],
        rents: { aino: rent(['2025-03-01', null, 89000]) },
        occupants: { aino: rent(['2025-03-01', null, 2]) },
        fees: { aino: [water, parking] },
        payments: [pay('2026-11', 89000, '2026-11-03')],
        from: '2026-11',
        to: '2026-11',
        today: '2026-11-22',
      })
      expect(row.expected).toBe(94900)
      expect(row.status).toEqual({ kind: 'partly_paid', missing: 5900 })
    })
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
        rents: { aino: rent(['2025-03-01', null, 0]) },
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
      rents: { aino: flat },
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
        rents: { pekka: flat },
        payments: [],
        today: '2026-11-22',
      }),
    ).toEqual([])
  })

  test("A month before its due date doesn't count", () => {
    const months = monthsNotFullyPaid({
      tenancies: [aino],
      rents: { aino: flat },
      payments: rentPaidThrough('2026-10'),
      today: '2026-11-03',
    })
    expect(months).toEqual([])
  })

  test('a partly paid month counts, a month without a rent does not', () => {
    const months = monthsNotFullyPaid({
      tenancies: [aino],
      rents: { aino: rent(['2025-03-01', '2026-09-30', 89000]) },
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
      rents: {
        pekka: rent(['2024-06-01', null, 89000]),
        aino: rent(['2025-02-15', null, 89000]),
      },
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

describe('The rent summary on the flats list', () => {
  const tenancy = (
    id: string,
    validFrom: string,
    validTo: string | null = null,
  ) => ({
    id,
    validFrom,
    validTo,
    dueDay: 5,
    contractType: 'open_ended' as const,
    termEnd: null,
    noticeGivenBy: null,
    noticeDate: null,
  })
  type T = ReturnType<typeof tenancy>
  const flat = (
    propertyId: string,
    tenancies: T[],
    rentPeriods: Period<number>[],
    payments: PaymentOfMonth[] = [],
  ): FlatRentData<T> => ({
    propertyId,
    tenancies,
    // Each tenancy with the same rent periods.
    rents: Object.fromEntries(tenancies.map((t) => [t.id, rentPeriods])),
    payments,
  })

  test("The summary adds up this month's rent of every flat", () => {
    const summary = rentThisMonth(
      [
        flat(
          'kuusikuja',
          [tenancy('aino', '2025-03-01')],
          rent(['2025-03-01', null, 89000]),
        ),
        flat(
          'koivupolku',
          [tenancy('ville', '2026-01-01')],
          rent(['2026-01-01', null, 64000]),
          [pay('2026-11', 64000, '2026-11-03', 'ville')],
        ),
        flat('rantatie', [], []),
      ],
      '2026-11-22',
    )
    expect(summary).toMatchObject({
      received: 64000,
      expected: 153000,
      late: 1,
      hasRent: true,
    })
    expect(summary.rows.kuusikuja?.status).toEqual({ kind: 'late', days: 17 })
    expect(summary.rows.koivupolku?.status.kind).toBe('paid')
    expect(summary.rows.rantatie).toBeUndefined()
  })

  test('A shared flat counts with its whole rent', () => {
    const summary = rentThisMonth(
      [
        flat(
          'kuusikuja',
          [tenancy('aino', '2025-03-01')],
          rent(['2025-03-01', null, 89000]),
        ),
      ],
      '2026-11-22',
    )
    expect(summary).toMatchObject({ received: 0, expected: 89000 })
  })

  test('A tenancy that starts mid-month counts by days', () => {
    const summary = rentThisMonth(
      [
        flat(
          'kuusikuja',
          [tenancy('aino', '2026-11-15')],
          rent(['2026-11-01', null, 90000]),
        ),
      ],
      '2026-11-22',
    )
    expect(summary).toMatchObject({ received: 0, expected: 48000 })
  })

  test('Both tenancies of a mid-month change count', () => {
    const summary = rentThisMonth(
      [
        flat(
          'kuusikuja',
          [
            tenancy('pekka', '2024-01-01', '2026-11-14'),
            tenancy('aino', '2026-11-15'),
          ],
          rent(['2024-01-01', null, 90000]),
          [pay('2026-11', 42000, '2026-11-02', 'pekka')],
        ),
      ],
      '2026-11-22',
    )
    expect(summary).toMatchObject({ received: 42000, expected: 90000 })
    // The card shows the current tenancy's month, due on its first day.
    expect(summary.rows.kuusikuja?.tenancy.id).toBe('aino')
    expect(summary.rows.kuusikuja?.status).toEqual({ kind: 'late', days: 7 })
    expect(summary.late).toBe(1)
  })

  test('A payment for a month without rent is left out', () => {
    const summary = rentThisMonth(
      [
        flat(
          'kuusikuja',
          [tenancy('aino', '2025-03-01')],
          rent(['2025-03-01', null, 89000]),
          [pay('2026-11', 89000, '2026-11-03')],
        ),
        flat(
          'koivupolku',
          [tenancy('ville', '2026-01-01')],
          [],
          [pay('2026-11', 50000, '2026-11-03', 'ville')],
        ),
      ],
      '2026-11-22',
    )
    expect(summary).toMatchObject({ received: 89000, expected: 89000 })
    expect(summary.rows.koivupolku?.status.kind).toBe('rent_not_set')
  })

  test('No summary without rent this month', () => {
    expect(rentThisMonth([flat('rantatie', [], [])], '2026-11-22')).toEqual({
      rows: {},
      expected: 0,
      received: 0,
      late: 0,
      hasRent: false,
    })
  })

  test('a tenancy that starts after this month has no card row', () => {
    const summary = rentThisMonth(
      [
        flat(
          'rantatie',
          [tenancy('aino', '2026-12-01')],
          rent(['2026-12-01', null, 90000]),
        ),
      ],
      '2026-11-22',
    )
    expect(summary.rows.rantatie).toBeUndefined()
    expect(summary.hasRent).toBe(false)
  })

  test("a payment for another month doesn't count", () => {
    const summary = rentThisMonth(
      [
        flat(
          'kuusikuja',
          [tenancy('aino', '2025-03-01')],
          rent(['2025-03-01', null, 89000]),
          [pay('2026-10', 89000, '2026-11-03')],
        ),
      ],
      '2026-11-22',
    )
    expect(summary.received).toBe(0)
  })
})
