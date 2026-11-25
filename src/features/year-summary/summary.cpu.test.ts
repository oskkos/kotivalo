// The Workers Free plan allows 10 ms of CPU time per request (design.md,
// risks). Workers tests can't measure it: workerd's clock stands still while
// code runs. This measures the calculation in Node (V8, like workerd) with 10
// flats and two years of data: about 3 ms on a laptop (2026-11-25), so the
// assertion is the limit itself, to stay stable on slower CI runners.
import { describe, expect, test } from 'vitest'
import type { Period as ValuePeriod } from '#/features/recurring-amounts/periods'
import { flatYear, type FlatYearInput } from './summary'

const amount = (value: number, validFrom: string): ValuePeriod<number> => ({
  validFrom,
  validTo: null,
  value,
})

const months = ['2025', '2026'].flatMap((year) =>
  Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`,
  ),
)

const flat = (n: number): FlatYearInput => ({
  propertyId: `flat-${String(n)}`,
  housingCompany: {
    name: 'As Oy',
    businessId: '0112038-9',
    apartmentNumber: 'A 1',
  },
  ownership: [
    {
      validFrom: '2025-01-01',
      validTo: '2025-06-30',
      reason: null,
      shares: [
        { userId: 'annika', share: 5000 },
        { userId: 'jussi', share: 5000 },
      ],
    },
    {
      validFrom: '2025-07-01',
      validTo: null,
      reason: 'sale',
      shares: [{ userId: 'annika', share: 10000 }],
    },
  ],
  tenancies: [
    {
      id: 'a',
      tenantName: 'Aino Koski',
      validFrom: '2025-01-01',
      validTo: '2025-12-31',
      dueDay: 5,
      occupants: [amount(2, '2025-01-01')],
      rent: [amount(89000, '2025-01-01')],
      fees: [
        {
          id: 'f',
          kind: 'water',
          description: null,
          basis: 'per_occupant',
          amounts: [amount(2000, '2025-01-01')],
        },
      ],
    },
    {
      id: 'b',
      tenantName: 'Mikko Laine',
      validFrom: '2026-01-01',
      validTo: null,
      dueDay: 5,
      occupants: [amount(1, '2026-01-01')],
      rent: [amount(92000, '2026-01-01')],
      fees: [],
    },
  ],
  payments: months.map((month) => ({
    tenancyId: month < '2026' ? 'a' : 'b',
    month,
    amount: 89000,
    paidOn: `${month}-04`,
  })),
  entries: months.map((month) => ({
    category: 'other_expense' as const,
    amount: 1500,
    date: `${month}-10`,
  })),
  charges: {
    maintenance: [amount(19617, '2025-01-01')],
    financing: [
      { id: 'r', name: 'Putkiremontti', periods: [amount(6050, '2025-01-01')] },
    ],
  },
  treatments: [
    { validFrom: '2025-01-01', validTo: null, value: 'income_recognised' },
  ],
  usageCharges: (['water', 'parking', 'sauna'] as const).map((kind) => ({
    id: kind,
    kind,
    basis: 'per_occupant' as const,
    description: null,
    periods: [amount(1200, '2025-01-01')],
  })),
})

describe('The year summary calculation', () => {
  test('stays inside the Free plan CPU time with 10 flats', () => {
    const flats = Array.from({ length: 10 }, (_, i) => flat(i))
    const run = () =>
      flats.map((input) => flatYear(input, 'annika', 2025, '2026-11-25'))
    run() // warm up
    const times = Array.from({ length: 5 }, () => {
      const start = performance.now()
      run()
      return performance.now() - start
    }).sort((a, b) => a - b)
    expect(times[2]).toBeLessThan(10)
  })
})
