import { describe, expect, test } from 'vitest'
import {
  earliestLastDay,
  noticePeriodMonths,
  validateEnding,
  type NoticeTenancy,
} from './notice'

const openEnded = (contractMade: string, validFrom: string): NoticeTenancy => ({
  contractType: 'open_ended',
  contractMade,
  validFrom,
  termEnd: null,
})

const aino = openEnded('2025-02-12', '2025-03-01')
const fixedTerm: NoticeTenancy = {
  contractType: 'fixed_term',
  contractMade: '2026-11-20',
  validFrom: '2027-01-01',
  termEnd: '2027-12-31',
}

describe('Notice periods', () => {
  test("The tenant's notice ends at the end of the next month", () => {
    expect(noticePeriodMonths('tenant', aino, '2026-11-22')).toBe(1)
    expect(earliestLastDay('tenant', aino, '2026-11-22')).toBe('2026-12-31')
  })

  test("Landlord's notice under an older contract after a year", () => {
    expect(noticePeriodMonths('landlord', aino, '2026-11-22')).toBe(6)
    expect(earliestLastDay('landlord', aino, '2026-11-22')).toBe('2027-05-31')
  })

  test("Landlord's notice under an older contract within the first year", () => {
    const tenancy = openEnded('2026-05-20', '2026-06-01')
    expect(noticePeriodMonths('landlord', tenancy, '2026-11-22')).toBe(3)
    expect(earliestLastDay('landlord', tenancy, '2026-11-22')).toBe(
      '2027-02-28',
    )
  })

  test("Landlord's notice under a newer contract within two years", () => {
    const tenancy = openEnded('2026-10-15', '2026-11-01')
    expect(noticePeriodMonths('landlord', tenancy, '2028-03-10')).toBe(3)
    expect(earliestLastDay('landlord', tenancy, '2028-03-10')).toBe(
      '2028-06-30',
    )
  })

  test("Landlord's notice under a newer contract after two years", () => {
    const tenancy = openEnded('2026-10-01', '2026-10-01')
    expect(noticePeriodMonths('landlord', tenancy, '2028-11-10')).toBe(4)
    expect(earliestLastDay('landlord', tenancy, '2028-11-10')).toBe(
      '2029-03-31',
    )
  })
})

describe('notice periods', () => {
  test('a year is reached on its anniversary, not a day before', () => {
    expect(noticePeriodMonths('landlord', aino, '2026-02-28')).toBe(3)
    expect(noticePeriodMonths('landlord', aino, '2026-03-01')).toBe(6)
  })

  test('the last day before the rule change keeps the old periods', () => {
    const older = openEnded('2026-09-30', '2024-01-01')
    const newer = openEnded('2026-10-01', '2024-01-01')
    expect(noticePeriodMonths('landlord', older, '2026-11-22')).toBe(6)
    expect(noticePeriodMonths('landlord', newer, '2026-11-22')).toBe(4)
  })

  test('an agreed ending has no notice period', () => {
    expect(noticePeriodMonths('agreed', aino, '2026-11-22')).toBe(0)
    expect(earliestLastDay('agreed', aino, '2026-11-22')).toBe('2026-11-22')
  })
})

describe('Ending a tenancy', () => {
  const today = '2026-11-22'

  test("A mid-month last rent day is accepted for the tenant's notice", () => {
    expect(
      validateEnding(
        aino,
        {
          noticeGivenBy: 'tenant',
          noticeDate: '2026-11-10',
          lastDay: '2026-12-15',
        },
        today,
      ),
    ).toBeUndefined()
  })

  test("The landlord's notice can't be shorter than the law allows", () => {
    expect(
      validateEnding(
        aino,
        {
          noticeGivenBy: 'landlord',
          noticeDate: '2026-11-22',
          lastDay: '2027-03-31',
        },
        today,
      ),
    ).toBe('tenancy_end_before_notice_period')
    expect(
      validateEnding(
        aino,
        {
          noticeGivenBy: 'landlord',
          noticeDate: '2026-11-22',
          lastDay: '2027-05-31',
        },
        today,
      ),
    ).toBeUndefined()
  })

  test('An agreed ending can be on any day after the notice', () => {
    expect(
      validateEnding(
        aino,
        {
          noticeGivenBy: 'agreed',
          noticeDate: '2026-11-22',
          lastDay: '2026-11-30',
        },
        today,
      ),
    ).toBeUndefined()
  })

  test('A notice date in the future is refused', () => {
    expect(
      validateEnding(
        aino,
        {
          noticeGivenBy: 'tenant',
          noticeDate: '2026-12-01',
          lastDay: '2027-01-31',
        },
        today,
      ),
    ).toBe('tenancy_notice_in_future')
  })
})

describe('ending a tenancy', () => {
  test('the last rent day before the notice is refused', () => {
    expect(
      validateEnding(
        aino,
        {
          noticeGivenBy: 'agreed',
          noticeDate: '2026-11-22',
          lastDay: '2026-11-21',
        },
        '2026-11-22',
      ),
    ).toBe('tenancy_end_before_notice')
  })

  test('a notice before the tenancy starts is refused', () => {
    expect(
      validateEnding(
        aino,
        {
          noticeGivenBy: 'tenant',
          noticeDate: '2025-02-20',
          lastDay: '2025-03-31',
        },
        '2026-11-22',
      ),
    ).toBe('tenancy_notice_before_start')
  })
})

describe('Ending a fixed-term tenancy early', () => {
  test('Notice on a fixed term is refused', () => {
    for (const by of ['tenant', 'landlord'] as const) {
      expect(
        validateEnding(
          fixedTerm,
          {
            noticeGivenBy: by,
            noticeDate: '2027-05-15',
            lastDay: '2027-06-30',
          },
          '2027-05-20',
        ),
      ).toBe('tenancy_fixed_term_notice')
    }
  })
  test('Another legal ground ends a fixed term early', () => {
    expect(
      validateEnding(
        fixedTerm,
        {
          noticeGivenBy: 'other',
          noticeDate: '2027-03-03',
          lastDay: '2027-03-31',
        },
        '2027-03-05',
      ),
    ).toBeUndefined()
  })
})

describe('ending a fixed-term tenancy early', () => {
  test('an agreed early end is accepted, but not on or after the term', () => {
    const agreed = (lastDay: string) =>
      validateEnding(
        fixedTerm,
        { noticeGivenBy: 'agreed', noticeDate: '2027-05-15', lastDay },
        '2027-05-20',
      )
    expect(agreed('2027-06-30')).toBeUndefined()
    expect(agreed('2027-12-31')).toBe('tenancy_end_after_term')
  })

  test("a court's permission has no notice period", () => {
    expect(
      validateEnding(
        fixedTerm,
        {
          noticeGivenBy: 'court',
          noticeDate: '2027-05-15',
          lastDay: '2027-05-31',
        },
        '2027-05-20',
      ),
    ).toBeUndefined()
  })
})
