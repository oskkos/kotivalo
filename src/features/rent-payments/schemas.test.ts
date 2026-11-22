import { describe, expect, test } from 'vitest'
import { recordRentPaymentInput, typedRentPayment } from './schemas'

const base = {
  propertyId: 'flat',
  tenancyId: 'tenancy',
  month: '2026-11',
  amount: '890',
  paidOn: '22.11.2026',
}

describe('Recording a rent payment', () => {
  test('An invalid amount is refused', () => {
    for (const text of ['0', '890,555', '-5', '100000,01', '', 'abc']) {
      const result = typedRentPayment.safeParse(text)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(
        'rent_payment_amount_invalid',
      )
    }
  })

  test('takes the amount with a comma or a point, in cents', () => {
    expect(typedRentPayment.parse('890,50')).toBe(89050)
    expect(typedRentPayment.parse('390.5')).toBe(39050)
    expect(typedRentPayment.parse('100 000')).toBe(10_000_000)
  })

  test('takes a typed date and a month', () => {
    expect(recordRentPaymentInput.parse(base)).toEqual({
      ...base,
      amount: 89000,
      paidOn: '2026-11-22',
    })
    expect(
      recordRentPaymentInput.safeParse({ ...base, month: '2026-13' }).success,
    ).toBe(false)
  })
})
