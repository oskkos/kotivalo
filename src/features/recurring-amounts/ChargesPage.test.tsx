import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import type { Period } from './periods'
import { ChargesPage, type ChargesPageView } from './ChargesPage'

// Links render as plain anchors; the router isn't under test here.
vi.mock('@tanstack/react-router', () => ({
  createLink: () => (props: { children: ReactNode; to: string }) => (
    <a href={props.to}>{props.children}</a>
  ),
}))

const p = (
  validFrom: string,
  validTo: string | null,
  value: number,
): Period<number> => ({ validFrom, validTo, value })

const view: ChargesPageView = {
  role: 'owner',
  today: '2026-11-23',
  amounts: {
    maintenance_charge: [
      p('2025-03-01', '2025-12-31', 20500),
      p('2026-01-01', null, 21400),
    ],
    financing_charge: [p('2025-03-01', null, 8600)],
  },
  treatments: [
    { validFrom: '2025-03-01', validTo: null, value: 'capitalised' },
  ],
}

function renderPage(
  overrides: Partial<ChargesPageView> = {},
  year?: number,
  onYear = vi.fn(),
) {
  render(
    <ChargesPage
      view={{ ...view, ...overrides }}
      propertyId="flat"
      address="Kuusikuja 3 B 12"
      year={year}
      onBack={vi.fn()}
      onYear={onYear}
    />,
  )
  return onYear
}

describe('charges page', () => {
  test('shows the year so far with the estimate and the months newest first', () => {
    renderPage()
    const summary = screen.getByRole('region', { name: 'Charges in 2026' })
    expect(summary).toHaveTextContent('€3,300.00')
    expect(summary).toHaveTextContent('11 months')
    expect(summary).toHaveTextContent('The whole year comes to €3,600.00')
    expect(summary).toHaveTextContent('Maintenance charge€2,354.00')
    expect(summary).toHaveTextContent(
      'Financing chargePlaced in reserve€946.00',
    )
    const months = within(screen.getByRole('list', { name: 'Months' }))
      .getAllByRole('listitem')
      .map((row) => row.textContent)
    expect(months).toHaveLength(11)
    expect(months[0]).toMatch(/^November/)
    expect(months[10]).toMatch(/^January/)
    expect(months[10]).toContain('Maintenance charge changed, was €205.00')
    expect(months[9]).not.toContain('changed')
  })

  test('an earlier year has no estimate', () => {
    renderPage({}, 2025)
    const summary = screen.getByRole('region', { name: 'Charges in 2025' })
    expect(summary).toHaveTextContent('€2,910.00')
    expect(summary).not.toHaveTextContent('whole year')
  })

  test('a year that is not offered falls back to the current year', () => {
    renderPage({}, 2019)
    expect(
      screen.getByRole('region', { name: 'Charges in 2026' }),
    ).toBeVisible()
  })

  test('no estimate in December', () => {
    renderPage({ today: '2026-12-05' })
    expect(
      screen.getByRole('region', { name: 'Charges in 2026' }),
    ).not.toHaveTextContent('whole year')
  })

  test('one financing line per treatment when it changes in the year', () => {
    renderPage({
      treatments: [
        {
          validFrom: '2025-03-01',
          validTo: '2026-06-30',
          value: 'capitalised',
        },
        { validFrom: '2026-07-01', validTo: null, value: 'income_recognised' },
      ],
    })
    const summary = screen.getByRole('region', { name: 'Charges in 2026' })
    expect(summary).toHaveTextContent('Placed in reserve€516.00')
    expect(summary).toHaveTextContent('Recorded as revenue€430.00')
  })

  test('choosing a year reports it', async () => {
    const onYear = renderPage()
    await userEvent.click(screen.getByRole('button', { name: '2025' }))
    expect(onYear).toHaveBeenCalledWith(2025)
  })

  test('without charges an owner gets the button to set them', () => {
    renderPage({ amounts: { maintenance_charge: [], financing_charge: [] } })
    expect(screen.getByText('No charges set')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Set charges' })).toHaveAttribute(
      'href',
      '/properties/$propertyId/amounts',
    )
    expect(screen.queryByRole('group', { name: 'Year' })).toBeNull()
  })

  test('without charges a member gets no button', () => {
    renderPage({
      role: 'member',
      amounts: { maintenance_charge: [], financing_charge: [] },
    })
    expect(screen.getByText('No charges set')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Set charges' })).toBeNull()
  })
})
