import { describe, expect, test } from 'vitest'
import { createTransactionInput, typedTransactionAmount } from './schemas'

const amount = (text: string) => typedTransactionAmount.safeParse(text)

const base = {
  propertyId: 'flat',
  type: 'expense',
  category: 'annual_repair',
  amount: '145,50',
  date: '12.11.2026',
  note: '  Putkimies, keittiön hana ',
}

describe('Logging an entry', () => {
  test('An invalid amount is refused', () => {
    for (const text of ['0', '-5', '100000', '12,345', '', 'abc']) {
      const result = amount(text)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(
        'transaction_amount_invalid',
      )
    }
  })
})

describe('Entry categories', () => {
  test('A category of the other type is refused', () => {
    const result = createTransactionInput.safeParse({
      ...base,
      type: 'income',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({
      path: ['category'],
      message: 'transaction_category_invalid',
    })
  })
})

describe('entry input', () => {
  test('typed fields become stored values', () => {
    expect(createTransactionInput.safeParse(base).data).toEqual({
      propertyId: 'flat',
      type: 'expense',
      category: 'annual_repair',
      amount: 14550,
      date: '2026-11-12',
      note: 'Putkimies, keittiön hana',
    })
  })

  test('amounts from one cent to 99 999,99 € are accepted', () => {
    expect(amount('0,01').data).toBe(1)
    expect(amount('99 999,99').data).toBe(9_999_999)
  })

  test('an empty note is null and a long one is refused', () => {
    expect(
      createTransactionInput.safeParse({ ...base, note: ' ' }).data?.note,
    ).toBeNull()
    const long = createTransactionInput.safeParse({
      ...base,
      note: 'x'.repeat(201),
    })
    expect(long.error?.issues[0]?.message).toBe('transaction_note_too_long')
    expect(
      createTransactionInput.safeParse({ ...base, note: 'x'.repeat(200) })
        .success,
    ).toBe(true)
  })

  test('an unknown category is refused', () => {
    expect(
      createTransactionInput.safeParse({ ...base, category: 'rent' }).error
        ?.issues[0]?.message,
    ).toBe('transaction_category_invalid')
  })
})
