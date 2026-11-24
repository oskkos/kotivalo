import { describe, expect, test } from 'vitest'
import {
  fillsBeforeFirst,
  firstPeriodMove,
  firstRentMove,
  periodAfterEnd,
  rentAfterEnd,
  rentInMonth,
  suggestedRent,
  validateRentDate,
  validateTenancyPeriodDate,
  valueInTenancyMonth,
} from './rent'

const period = (validFrom: string, validTo: string | null, value: number) => ({
  validFrom,
  validTo,
  value,
})

describe('The rent of a tenancy', () => {
  test("The first rent starts on the tenancy's start day", () => {
    const rents = [period('2026-11-15', null, 90000)]
    const tenancy = { validFrom: '2026-11-15' }
    expect(rentInMonth(rents, tenancy, '2026-11')).toBe(90000)
    expect(rentInMonth(rents, tenancy, '2026-10')).toBeUndefined()
    expect(rentInMonth(rents, tenancy, '2027-01')).toBe(90000)
  })

  test('Each tenancy has its own rent', () => {
    const pekka = { validFrom: '2025-01-01' }
    const aino = { validFrom: '2026-11-15' }
    expect(
      rentInMonth([period('2025-01-01', null, 80000)], pekka, '2026-11'),
    ).toBe(80000)
    expect(
      rentInMonth([period('2026-11-15', null, 90000)], aino, '2026-11'),
    ).toBe(90000)
  })

  test("a month's rent comes from its first day after the start month", () => {
    const rents = [
      period('2025-03-15', '2026-02-28', 89000),
      period('2026-03-01', null, 92000),
    ]
    const tenancy = { validFrom: '2025-03-15' }
    expect(rentInMonth(rents, tenancy, '2026-02')).toBe(89000)
    expect(rentInMonth(rents, tenancy, '2026-03')).toBe(92000)
  })

  test('a migrated tenancy has no rent before its first period', () => {
    const rents = [period('2025-01-01', null, 89000)]
    const tenancy = { validFrom: '2024-06-01' }
    expect(rentInMonth(rents, tenancy, '2024-06')).toBeUndefined()
    expect(rentInMonth(rents, tenancy, '2024-12')).toBeUndefined()
    expect(rentInMonth(rents, tenancy, '2025-01')).toBe(89000)
  })
})

describe('the date of a new rent', () => {
  const tenancy = { validFrom: '2025-03-15', validTo: '2027-01-31' }

  test('the first of a month or the start day inside the tenancy', () => {
    const limits = {
      tenancy,
      starts: ['2025-03-15'],
    }
    expect(validateRentDate('2026-03-01', limits)).toBeUndefined()
    expect(validateRentDate('2025-03-15', limits)).toBeUndefined()
    expect(validateRentDate('2027-01-01', limits)).toBeUndefined()
  })

  test('refused in the order of the rules', () => {
    const limits = {
      tenancy,
      starts: ['2025-03-15', '2026-03-01'],
    }
    expect(validateRentDate('2026-03-15', limits)).toBe(
      'amount_date_not_month_start',
    )
    expect(validateRentDate('2025-01-01', limits)).toBe(
      'rent_date_before_tenancy',
    )
    expect(validateRentDate('2027-02-01', limits)).toBe(
      'rent_date_after_tenancy',
    )
    expect(validateRentDate('2025-06-01', limits)).toBe('amount_date_too_early')
  })

  test('a date before the first period fills the months up to it', () => {
    const migrated = { validFrom: '2024-06-01', validTo: null }
    const limits = {
      tenancy: migrated,
      starts: ['2025-01-01', '2026-03-01'],
    }
    expect(validateRentDate('2024-06-01', limits)).toBeUndefined()
    expect(validateRentDate('2024-09-01', limits)).toBeUndefined()
    expect(fillsBeforeFirst('2024-06-01', limits.starts[0])).toBe(true)
    expect(validateRentDate('2024-09-15', limits)).toBe(
      'amount_date_not_month_start',
    )
    expect(validateRentDate('2024-05-01', limits)).toBe(
      'rent_date_before_tenancy',
    )
    expect(fillsBeforeFirst('2025-01-01', limits.starts[0])).toBe(false)
    expect(validateRentDate('2025-06-01', limits)).toBe('amount_date_too_early')
  })

  test('an open-ended tenancy has no last day', () => {
    expect(
      validateRentDate('2040-01-01', {
        tenancy: { validFrom: '2025-03-01', validTo: null },
        starts: [],
      }),
    ).toBeUndefined()
  })

  test('Correcting an earlier rent period', () => {
    const limits = {
      tenancy: { validFrom: '2025-03-01', validTo: null },
      starts: ['2025-03-01', '2026-01-01'],
    }
    expect(validateRentDate('2025-03-01', limits)).toBeUndefined()
    expect(validateRentDate('2026-01-01', limits)).toBeUndefined()
    expect(validateRentDate('2025-06-01', limits)).toBe('amount_date_too_early')
  })
})

describe('the suggested rent of a new tenancy', () => {
  const pekka = {
    validFrom: '2023-06-01',
    rents: [period('2023-06-01', null, 82000)],
  }
  const aino = {
    validFrom: '2025-03-01',
    rents: [
      period('2025-03-01', '2026-02-28', 85000),
      period('2026-03-01', null, 89000),
    ],
  }

  test('the latest rent of the tenancy that starts last before the start', () => {
    expect(suggestedRent([aino, pekka], '2027-01-01')).toBe(89000)
    expect(suggestedRent([aino, pekka], '2024-01-01')).toBe(82000)
  })

  test('none before the first tenancy, or without a rent', () => {
    expect(suggestedRent([aino, pekka], '2023-01-01')).toBeUndefined()
    expect(suggestedRent([], '2027-01-01')).toBeUndefined()
    expect(
      suggestedRent([{ validFrom: '2025-03-01', rents: [] }], '2027-01-01'),
    ).toBeUndefined()
  })
})

describe('Rent changes stay inside their tenancy', () => {
  test('Moving the start moves the first rent', () => {
    expect(
      firstRentMove(
        [period('2025-03-01', null, 89000)],
        '2025-03-01',
        '2025-03-15',
      ),
    ).toEqual({ ok: true, move: { from: '2025-03-01', to: '2025-03-15' } })
  })

  test('Moving the start earlier moves the first rent', () => {
    expect(
      firstRentMove(
        [period('2025-03-15', null, 89000)],
        '2025-03-15',
        '2025-02-15',
      ),
    ).toEqual({ ok: true, move: { from: '2025-03-15', to: '2025-02-15' } })
  })

  test('A start after a rent change is refused', () => {
    expect(
      firstRentMove(
        [
          period('2025-03-01', '2026-02-28', 89000),
          period('2026-03-01', null, 92000),
        ],
        '2025-03-01',
        '2026-04-01',
      ),
    ).toEqual({ ok: false, reason: 'tenancy_start_after_rent_change' })
  })

  test('a later first rent of a migrated tenancy stays unless passed', () => {
    const rents = [period('2025-01-01', null, 89000)]
    expect(firstRentMove(rents, '2024-06-01', '2024-07-01')).toEqual({
      ok: true,
      move: null,
    })
    expect(firstRentMove(rents, '2024-06-01', '2025-02-01')).toEqual({
      ok: true,
      move: { from: '2025-01-01', to: '2025-02-01' },
    })
    expect(firstRentMove([], '2024-06-01', '2025-02-01')).toEqual({
      ok: true,
      move: null,
    })
  })

  test('a last day before the latest rent period leaves it outside', () => {
    const rents = [
      period('2026-03-01', '2027-02-28', 89000),
      period('2027-03-01', null, 92000),
    ]
    expect(rentAfterEnd(rents, '2027-01-31')).toBe(true)
    expect(rentAfterEnd(rents, '2027-03-01')).toBe(false)
    expect(rentAfterEnd(rents, null)).toBe(false)
    expect(rentAfterEnd([], '2027-01-31')).toBe(false)
  })
})

describe('Occupants of a tenancy', () => {
  test("The first occupants start on the tenancy's start day", () => {
    const occupants = [period('2026-11-15', null, 2)]
    const tenancy = { validFrom: '2026-11-15' }
    expect(valueInTenancyMonth(occupants, tenancy, '2026-11')).toBe(2)
    expect(valueInTenancyMonth(occupants, tenancy, '2026-10')).toBeUndefined()
  })

  test('A change of occupants ends the previous period the day before', () => {
    const occupants = [
      period('2025-03-01', '2026-08-31', 1),
      period('2026-09-01', null, 2),
    ]
    const tenancy = { validFrom: '2025-03-01' }
    expect(valueInTenancyMonth(occupants, tenancy, '2026-08')).toBe(1)
    expect(valueInTenancyMonth(occupants, tenancy, '2026-09')).toBe(2)
  })
})

describe('the date of a new occupants or fee period', () => {
  const tenancy = { validFrom: '2025-03-15', validTo: '2027-01-31' }

  test('the first of a month or the start day inside the tenancy', () => {
    const limits = { tenancy, latestStart: undefined }
    expect(validateTenancyPeriodDate('2026-02-01', limits)).toBeUndefined()
    expect(validateTenancyPeriodDate('2025-03-15', limits)).toBeUndefined()
    expect(validateTenancyPeriodDate('2026-02-10', limits)).toBe(
      'amount_date_not_month_start',
    )
    expect(validateTenancyPeriodDate('2025-03-01', limits)).toBe(
      'rent_date_before_tenancy',
    )
    expect(validateTenancyPeriodDate('2027-02-01', limits)).toBe(
      'rent_date_after_tenancy',
    )
  })

  test('not before the latest period, on its start it corrects it', () => {
    const limits = { tenancy, latestStart: '2026-06-01' }
    expect(validateTenancyPeriodDate('2026-06-01', limits)).toBeUndefined()
    expect(validateTenancyPeriodDate('2026-07-01', limits)).toBeUndefined()
    expect(validateTenancyPeriodDate('2026-05-01', limits)).toBe(
      'amount_date_too_early',
    )
  })

  test('a date before the first period is not a fill', () => {
    expect(
      validateTenancyPeriodDate('2025-04-01', {
        tenancy,
        latestStart: '2026-02-01',
      }),
    ).toBe('amount_date_too_early')
  })
})

describe('Occupants and fees stay inside their tenancy', () => {
  test('Moving the start moves the first occupants and fees', () => {
    const water = [period('2025-03-01', null, 2200)]
    const parking = [period('2026-02-01', null, 1500)]
    expect(firstPeriodMove(water, '2025-03-01', '2025-03-15')).toEqual({
      ok: true,
      move: { from: '2025-03-01', to: '2025-03-15' },
    })
    expect(firstPeriodMove(parking, '2025-03-01', '2025-03-15')).toEqual({
      ok: true,
      move: null,
    })
  })

  test('A start after an occupants change is refused', () => {
    const occupants = [
      period('2025-03-01', '2026-08-31', 1),
      period('2026-09-01', null, 2),
    ]
    expect(firstPeriodMove(occupants, '2025-03-01', '2026-10-01')).toEqual({
      ok: false,
    })
  })

  test('Ending before an occupants change is refused', () => {
    const occupants = [
      period('2025-03-01', '2027-02-28', 1),
      period('2027-03-01', null, 2),
    ]
    expect(periodAfterEnd(occupants, '2027-01-31')).toBe(true)
    expect(periodAfterEnd(occupants, '2027-03-31')).toBe(false)
    expect(periodAfterEnd(occupants, null)).toBe(false)
  })

  test('Ending before a fee change is refused', () => {
    const parking = [
      period('2026-02-01', '2027-02-28', 1500),
      period('2027-03-01', null, 2000),
    ]
    expect(periodAfterEnd(parking, '2027-01-31')).toBe(true)
  })
})
