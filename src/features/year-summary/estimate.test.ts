import { describe, expect, test } from 'vitest'
import { capitalIncomeTax, yearEstimate } from './estimate'
import type { FlatCard, HolderView } from './view'

const card = (income: number, costs: number): FlatCard => ({
  propertyId: `flat-${String(income)}-${String(costs)}`,
  streetAddress: 'Kuusikuja 3 B 12',
  housingCompanyName: null,
  businessId: null,
  share: 5000,
  income,
  costs,
  checks: [],
  owners: [],
})

const own: HolderView = { kind: 'own' }
const person: HolderView = { kind: 'person', userId: 'mikko', name: 'Mikko' }
const whole: HolderView = { kind: 'whole' }

describe('Rental income after costs', () => {
  test('The rental income after costs of the year', () => {
    const estimate = yearEstimate(
      [card(489500, 225500), card(381600, 224800)],
      own,
    )
    expect(estimate).toMatchObject({
      income: 871100,
      costs: 450300,
      net: 420800,
    })
  })
})

describe('The capital income tax estimate', () => {
  test('The estimate of the own share', () => {
    const estimate = yearEstimate([card(871100, 450300)], own)
    expect(estimate.kind).toBe('own')
    expect(estimate.tax).toBe(126200)
  })

  test('The estimate is rounded to whole euros', () => {
    // 30 % of 1 235,00 € is 370,50 €: half up.
    expect(capitalIncomeTax(123500)).toBe(37100)
    expect(capitalIncomeTax(123499)).toBe(37000)
    expect(capitalIncomeTax(100)).toBe(0)
  })

  test('No tax for another owner or the whole flats', () => {
    expect(yearEstimate([card(871100, 450300)], person)).toMatchObject({
      kind: 'person',
      tax: null,
      net: 420800,
    })
    expect(yearEstimate([card(871100, 450300)], whole)).toMatchObject({
      kind: 'whole',
      tax: null,
    })
  })
})

describe('A rental loss in the estimate', () => {
  test('A loss in the year', () => {
    const estimate = yearEstimate([card(178000, 302000)], own)
    expect(estimate).toMatchObject({ net: -124000, tax: null, kind: 'loss' })
  })

  test('No income after costs', () => {
    const estimate = yearEstimate([card(225500, 225500)], own)
    expect(estimate).toMatchObject({ net: 0, tax: 0, kind: 'own' })
  })
})
