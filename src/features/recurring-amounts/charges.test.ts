import { describe, expect, test } from 'vitest'
import {
  chargesOfYear,
  chargeYears,
  type ChargeMonth,
  type ChargePeriods,
} from './charges'
import type { Period } from './periods'
import type { FinancingTreatment } from '#/server/db/schema'

const p = (
  validFrom: string,
  validTo: string | null,
  value: number,
): Period<number> => ({ validFrom, validTo, value })

const t = (
  validFrom: string,
  validTo: string | null,
  value: FinancingTreatment,
): Period<FinancingTreatment> => ({ validFrom, validTo, value })

/** The maintenance charge and one unnamed financing charge, if any. */
const charges = (
  maintenance: Period<number>[],
  financing: Period<number>[] = [],
): ChargePeriods => ({
  maintenance,
  financing:
    financing.length === 0
      ? []
      : [{ id: 'fin', name: null, periods: financing }],
})

const line = (treatment: string, cents: number) => ({
  chargeId: 'fin',
  name: null,
  treatment,
  cents,
})

const of = (row: ChargeMonth | undefined, key: string) =>
  row?.charges.find((charge) => charge.key === key)

const months = (year: number, from: number, to: number): string[] =>
  Array.from(
    { length: to - from + 1 },
    (_, i) => `${String(year)}-${String(to - i).padStart(2, '0')}`,
  )

describe('Charges of a month', () => {
  test("A year's charges up to the current month", () => {
    const year = chargesOfYear(
      charges([p('2026-01-01', null, 21400)], [p('2025-03-01', null, 8600)]),
      [],
      2026,
      '2026-11-23',
    )
    expect(year.months.map((m) => m.month)).toEqual(months(2026, 1, 11))
    expect(year.months.every((m) => m.total === 30000)).toBe(true)
    expect(year.maintenance).toBe(235400)
    expect(year.financing).toEqual([line('not_set', 94600)])
    expect(year.total).toBe(330000)
  })

  test('An earlier year starts from the first charge', () => {
    const year = chargesOfYear(
      charges([p('2025-03-01', null, 20500)], [p('2025-03-01', null, 8600)]),
      [],
      2025,
      '2026-11-23',
    )
    expect(year.months.map((m) => m.month)).toEqual(months(2025, 3, 12))
    expect(year.months.every((m) => m.total === 29100)).toBe(true)
    expect(year.total).toBe(291000)
    expect(year.estimate).toBeUndefined()
  })

  test('A change shows the previous amount', () => {
    const periods = charges([
      p('2025-03-01', '2025-12-31', 20500),
      p('2026-01-01', null, 21400),
    ])
    const year = chargesOfYear(periods, [], 2026, '2026-11-23')
    const jan = year.months.find((m) => m.month === '2026-01')
    const feb = year.months.find((m) => m.month === '2026-02')
    expect(of(jan, 'maintenance')).toMatchObject({
      cents: 21400,
      previous: 20500,
    })
    expect(of(feb, 'maintenance')?.previous).toBeUndefined()
  })

  test('The first month of a charge is not a change', () => {
    const year = chargesOfYear(
      charges([], [p('2025-03-01', null, 8600)]),
      [],
      2025,
      '2026-11-23',
    )
    const march = year.months.find((m) => m.month === '2025-03')
    expect(of(march, 'fin')).toEqual({
      key: 'fin',
      kind: 'financing_charge',
      name: null,
      cents: 8600,
    })
    expect(of(march, 'maintenance')).toBeUndefined()
  })

  test('Several financing charges in a year', () => {
    const year = chargesOfYear(
      {
        maintenance: [p('2026-01-01', null, 21400)],
        financing: [
          {
            id: 'putki',
            name: 'Putkiremontti',
            periods: [p('2025-03-01', null, 8600)],
          },
          {
            id: 'julkisivu',
            name: 'Julkisivu',
            periods: [p('2026-01-01', null, 4200)],
          },
          {
            id: 'hissi',
            name: 'Hissiremontti',
            periods: [
              p('2025-03-01', '2025-12-31', 2400),
              p('2026-01-01', null, 0),
            ],
          },
        ],
      },
      [t('2025-03-01', null, 'capitalised')],
      2026,
      '2026-11-23',
    )
    expect(year.months.every((m) => m.total === 34200)).toBe(true)
    expect(year.maintenance).toBe(235400)
    expect(year.financing).toEqual([
      {
        chargeId: 'putki',
        name: 'Putkiremontti',
        treatment: 'capitalised',
        cents: 94600,
      },
      {
        chargeId: 'julkisivu',
        name: 'Julkisivu',
        treatment: 'capitalised',
        cents: 46200,
      },
    ])
    const jan = year.months.at(-1)
    expect(of(jan, 'julkisivu')?.started).toBe(true)
    expect(of(jan, 'hissi')?.ended).toBe(true)
    expect(of(jan, 'hissi')?.previous).toBeUndefined()
    const feb = year.months.at(-2)
    expect(of(feb, 'julkisivu')?.started).toBeUndefined()
    expect(of(feb, 'hissi')?.ended).toBeUndefined()
  })

  test('The financing charge by treatment when it changes mid-year', () => {
    const year = chargesOfYear(
      charges([], [p('2026-01-01', null, 8600)]),
      [
        t('2025-03-01', '2026-06-30', 'capitalised'),
        t('2026-07-01', null, 'income_recognised'),
      ],
      2026,
      '2026-11-23',
    )
    expect(year.financing).toEqual([
      line('income_recognised', 43000),
      line('capitalised', 51600),
    ])
  })

  test('A financing charge without a treatment', () => {
    const year = chargesOfYear(
      charges([], [p('2026-01-01', null, 8600)]),
      [],
      2026,
      '2026-11-23',
    )
    expect(year.financing).toEqual([line('not_set', 94600)])
    expect(year.months[0]?.treatment).toBeUndefined()
  })

  test('The whole-year estimate includes a change set for later in the year', () => {
    const year = chargesOfYear(
      charges(
        [p('2026-01-01', '2026-11-30', 21400), p('2026-12-01', null, 22600)],
        [p('2025-03-01', null, 8600)],
      ),
      [],
      2026,
      '2026-11-23',
    )
    expect(year.total).toBe(330000)
    expect(year.estimate).toBe(361200)
  })

  test('No estimate in December', () => {
    const year = chargesOfYear(
      charges([p('2026-01-01', null, 21400)]),
      [],
      2026,
      '2026-12-05',
    )
    expect(year.months).toHaveLength(12)
    expect(year.estimate).toBeUndefined()
  })

  test('The years since the first charge', () => {
    // The rent is not a charge, so its earlier start doesn't add 2024.
    expect(
      chargeYears(charges([p('2025-03-01', null, 20500)]), '2026-11-23'),
    ).toEqual([2026, 2025])
  })

  test('Charges set only from a later month', () => {
    const periods = charges([p('2027-01-01', null, 22600)])
    expect(chargeYears(periods, '2026-11-23')).toEqual([])
    expect(chargesOfYear(periods, [], 2026, '2026-11-23').months).toEqual([])
  })
})
