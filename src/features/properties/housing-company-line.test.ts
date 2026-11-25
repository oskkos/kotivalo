import { describe, expect, test } from 'vitest'
import { housingCompanyLine } from './housing-company-line'

// The unit tests run in Finnish.
describe('Housing company details of a flat', () => {
  test('Only the filled-in details are shown', () => {
    expect(
      housingCompanyLine({ housingCompanyName: 'As Oy Kuusikuja 3' }),
    ).toBe('As Oy Kuusikuja 3')
    expect(housingCompanyLine({ apartmentNumber: 'B 12' })).toBe(
      'huoneisto B 12',
    )
    expect(housingCompanyLine({ businessId: '2345678-0' })).toBe(
      'Y-tunnus 2345678-0',
    )
  })

  test('joins the filled-in details in order with a dot', () => {
    expect(
      housingCompanyLine({
        housingCompanyName: 'As Oy Kuusikuja 3',
        businessId: '2345678-0',
        apartmentNumber: 'B 12',
      }),
    ).toBe('As Oy Kuusikuja 3 · huoneisto B 12 · Y-tunnus 2345678-0')
  })

  test('is empty without any details', () => {
    expect(housingCompanyLine({})).toBe('')
  })
})
