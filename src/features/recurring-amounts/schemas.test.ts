import { describe, expect, test } from 'vitest'
import {
  addFinancingChargeInput,
  financingChargeName,
  setAmountInput,
  setTreatmentInput,
  typedAmount,
} from './schemas'

const amount = (text: string) => typedAmount.safeParse(text)

describe('Rent and charges are recorded as monthly periods', () => {
  test('An invalid amount is refused', () => {
    for (const text of ['-5', '100000', '12,345', '', 'abc']) {
      const result = amount(text)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe('amount_invalid')
    }
  })
})

describe('typed amounts', () => {
  test('euros with a comma or a point become cents', () => {
    expect(amount('214').data).toBe(21400)
    expect(amount('214,5').data).toBe(21450)
    expect(amount('1 214.50').data).toBe(121450)
    expect(amount('0').data).toBe(0)
    expect(amount('99999,99').data).toBe(9999999)
  })
})

describe('start dates', () => {
  test('the first of a month is accepted, other days are not', () => {
    const base = { propertyId: 'flat', kind: 'rent', amount: '890' }
    expect(
      setAmountInput.safeParse({ ...base, from: '1.3.2025' }).data,
    ).toEqual({
      propertyId: 'flat',
      kind: 'rent',
      amount: 89000,
      from: '2025-03-01',
    })
    expect(
      setAmountInput.safeParse({ ...base, from: '15.3.2025' }).error?.issues[0]
        ?.message,
    ).toBe('amount_date_not_month_start')
    expect(
      setTreatmentInput.safeParse({
        propertyId: 'flat',
        treatment: 'capitalised',
        from: '2.3.2025',
      }).error?.issues[0]?.message,
    ).toBe('amount_date_not_month_start')
  })
})

describe('Adding a financing charge', () => {
  test('A financing charge needs a name', () => {
    for (const name of ['', '  ']) {
      expect(
        addFinancingChargeInput.safeParse({
          propertyId: 'flat',
          name,
          amount: '42',
          from: '1.1.2026',
        }).error?.issues[0]?.message,
      ).toBe('financing_charge_name_required')
    }
  })
})

describe('financing charge names', () => {
  test('a name is trimmed and at most 60 characters', () => {
    expect(financingChargeName.parse('  Julkisivu ')).toBe('Julkisivu')
    expect(financingChargeName.safeParse('x'.repeat(60)).success).toBe(true)
    expect(
      financingChargeName.safeParse('x'.repeat(61)).error?.issues[0]?.message,
    ).toBe('financing_charge_name_too_long')
  })

  test('a charge id goes with a financing charge, and only with one', () => {
    const base = { propertyId: 'flat', amount: '42', from: '1.1.2026' }
    expect(
      setAmountInput.safeParse({
        ...base,
        kind: 'financing_charge',
        chargeId: 'c1',
      }).success,
    ).toBe(true)
    expect(
      setAmountInput.safeParse({ ...base, kind: 'rent', chargeId: 'c1' })
        .success,
    ).toBe(false)
    expect(
      setAmountInput.safeParse({ ...base, kind: 'financing_charge' }).success,
    ).toBe(false)
  })
})
