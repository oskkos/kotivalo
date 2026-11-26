import { describe, expect, test } from 'vitest'
import { tenancyFields } from './schemas'
import { validateTenancyDates } from './rules'

const limits = {
  today: '2026-11-22',
  ownershipStart: '2025-03-01',
  others: [],
}

const openEnded = (validFrom: string, contractMade = validFrom) => ({
  contractType: 'open_ended' as const,
  contractMade,
  validFrom,
  termEnd: null,
  validTo: null,
})

const fixedTerm = (validFrom: string, termEnd: string) => ({
  contractType: 'fixed_term' as const,
  contractMade: '2026-11-20',
  validFrom,
  termEnd,
  validTo: termEnd,
})

describe('Tenancy dates and details', () => {
  test('A tenancy overlapping the previous one is refused', () => {
    expect(
      validateTenancyDates(openEnded('2026-12-15', '2026-11-20'), {
        ...limits,
        others: [{ validFrom: '2025-03-01', validTo: '2026-12-31' }],
      }),
    ).toBe('tenancy_overlaps')
  })

  test('A new tenant can be added during the notice period', () => {
    expect(
      validateTenancyDates(openEnded('2027-01-01', '2026-11-20'), {
        ...limits,
        others: [{ validFrom: '2025-03-01', validTo: '2026-12-31' }],
      }),
    ).toBeUndefined()
  })

  test("A tenancy can't be added while one runs without an end", () => {
    expect(
      validateTenancyDates(fixedTerm('2030-01-01', '2030-12-31'), {
        ...limits,
        others: [{ validFrom: '2025-03-01', validTo: null }],
      }),
    ).toBe('tenancy_overlaps')
  })

  test('An earlier tenancy can be added afterwards', () => {
    expect(
      validateTenancyDates(fixedTerm('2025-03-01', '2025-12-31'), {
        ...limits,
        others: [{ validFrom: '2026-01-01', validTo: null }],
      }),
    ).toBeUndefined()
  })

  test('A tenancy before the ownership is refused', () => {
    expect(validateTenancyDates(openEnded('2025-02-15'), limits)).toBe(
      'tenancy_start_before_ownership',
    )
  })

  test('Contract made in the future is refused', () => {
    expect(
      validateTenancyDates(openEnded('2027-01-01', '2026-11-30'), limits),
    ).toBe('tenancy_contract_made_in_future')
  })

  test('A fixed term ending before it starts is refused', () => {
    expect(
      validateTenancyDates(fixedTerm('2027-01-01', '2026-12-31'), limits),
    ).toBe('tenancy_end_before_start')
  })

  test('Invalid tenant details are refused', () => {
    const typed = {
      tenantName: 'Aino Koski',
      tenantPhone: '',
      tenantEmail: '',
      contractType: 'open_ended',
      contractMade: '12.2.2025',
      validFrom: '1.3.2025',
      termEnd: '',
      dueDay: '5',
    }
    const reasons = (changes: Partial<typeof typed>) =>
      tenancyFields
        .safeParse({ ...typed, ...changes })
        .error?.issues.map((issue) => issue.message)
    expect(reasons({})).toBeUndefined()
    expect(reasons({ tenantName: '  ' })).toEqual(['tenant_name_required'])
    expect(reasons({ tenantEmail: 'aino@' })).toEqual(['email_invalid'])
    expect(reasons({ dueDay: '0' })).toEqual(['tenancy_due_day_invalid'])
    expect(reasons({ dueDay: '32' })).toEqual(['tenancy_due_day_invalid'])
  })
})

describe('tenancy details', () => {
  test('empty contact details become null, and a term only for a fixed term', () => {
    const parsed = tenancyFields.parse({
      tenantName: ' Aino Koski ',
      tenantPhone: ' ',
      tenantEmail: '',
      contractType: 'open_ended',
      contractMade: '12.2.2025',
      validFrom: '1.3.2025',
      termEnd: '31.12.2025',
      dueDay: '5',
    })
    expect(parsed).toMatchObject({
      tenantName: 'Aino Koski',
      tenantPhone: null,
      tenantEmail: null,
      validFrom: '2025-03-01',
      termEnd: null,
      dueDay: 5,
    })
    const fixed = tenancyFields.safeParse({
      ...parsed,
      contractType: 'fixed_term',
      contractMade: '12.2.2025',
      validFrom: '1.3.2025',
      tenantPhone: '',
      tenantEmail: '',
      termEnd: '',
      dueDay: '5',
      deposit: '',
    })
    expect(fixed.error?.issues.map((issue) => issue.message)).toEqual([
      'tenancy_end_before_start',
    ])
  })

  test('a name over 100 characters and a phone over 30 are refused', () => {
    const result = tenancyFields.safeParse({
      tenantName: 'a'.repeat(101),
      tenantPhone: '0'.repeat(31),
      tenantEmail: '',
      contractType: 'open_ended',
      contractMade: '12.2.2025',
      validFrom: '1.3.2025',
      termEnd: '',
      dueDay: '5',
    })
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'tenant_name_too_long',
      'tenant_phone_too_long',
    ])
  })
})
