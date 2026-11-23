import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { YearChoice } from './YearChoice'

describe('year choice', () => {
  test('presses the chosen year and reports another choice', () => {
    const onYear = vi.fn()
    render(
      <YearChoice
        label="Year"
        years={[2026, 2025]}
        year={2026}
        onYear={onYear}
      />,
    )
    const group = screen.getByRole('group', { name: 'Year' })
    expect(within(group).getByRole('button', { name: '2026' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(within(group).getByRole('button', { name: '2025' }))
    expect(onYear).toHaveBeenCalledWith(2025)
  })
})
