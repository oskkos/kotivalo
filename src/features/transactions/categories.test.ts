import { describe, expect, test } from 'vitest'
import { CATEGORIES, categoriesOf, categoryFits } from './categories'

describe('entry categories', () => {
  test('each type has its own categories in form order', () => {
    expect(categoriesOf('income')).toEqual([
      'tenant_water_charge',
      'other_income',
    ])
    expect(categoriesOf('expense')).toEqual([
      'annual_repair',
      'improvement',
      'water_charge',
      'insurance',
      'other_expense',
    ])
  })

  test('categories map to form 7H rows; income is gross rent', () => {
    expect(CATEGORIES.annual_repair.row).toBe('annual_repairs')
    expect(CATEGORIES.water_charge.row).toBe('maintenance_and_water')
    expect(CATEGORIES.insurance.row).toBe('other_costs')
    // Depreciated a tenth a year or deducted on sale, never all at once.
    expect(CATEGORIES.improvement.row).toBeNull()
    expect(
      categoriesOf('income').every(
        (category) => CATEGORIES[category].row === 'gross_rent',
      ),
    ).toBe(true)
  })

  test('a category fits only its own type', () => {
    expect(categoryFits('expense', 'annual_repair')).toBe(true)
    expect(categoryFits('income', 'annual_repair')).toBe(false)
  })
})
