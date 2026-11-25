import { render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { UsageChargePeriods } from './months'
import { UsageChargesByMonthPage } from './UsageChargesByMonthPage'

// jsdom's browser language is English, so the page is in English.
vi.mock('@tanstack/react-router', () => ({
  createLink: () => (props: { children: unknown; to: string }) => (
    <a href={props.to}>{props.children as string}</a>
  ),
}))

const water: UsageChargePeriods = {
  id: 'water',
  kind: 'water',
  basis: 'per_occupant',
  description: null,
  periods: [{ validFrom: '2026-01-01', validTo: null, value: 2200 }],
}
const parking: UsageChargePeriods = {
  id: 'parking',
  kind: 'parking',
  basis: 'fixed',
  description: null,
  periods: [{ validFrom: '2026-02-01', validTo: null, value: 1500 }],
}
const aino = {
  validFrom: '2025-03-01',
  validTo: null,
  occupants: [
    { validFrom: '2025-03-01', validTo: '2026-08-31', value: 1 },
    { validFrom: '2026-09-01', validTo: null, value: 2 },
  ],
}

function setup(
  charges: UsageChargePeriods[],
  role: 'owner' | 'member' = 'owner',
) {
  render(
    <UsageChargesByMonthPage
      view={{ role, today: '2026-11-24', charges, tenancies: [aino] }}
      propertyId="flat"
      address="Kuusikuja 3 B 12"
      onBack={vi.fn()}
      onYear={vi.fn()}
    />,
  )
}

describe('The usage charges by month page', () => {
  test("The current year's usage charges by month", () => {
    setup([water, parking])
    const total = screen.getByRole('region', { name: 'Usage charges in 2026' })
    expect(total).toHaveTextContent('€458.00')
    expect(total).toHaveTextContent('Water charge€308.00')
    expect(total).toHaveTextContent('Parking space€150.00')
    const months = within(
      screen.getByRole('list', { name: 'Months' }),
    ).getAllByRole('listitem')
    expect(months[0]).toHaveTextContent('November')
    expect(months[0]).toHaveTextContent('Water charge 2 × €22.00')
    expect(months[0]).toHaveTextContent('€59.00')
    expect(months[2]).toHaveTextContent('September')
    expect(months[2]).toHaveTextContent('Water charge changed, was €22.00')
  })

  test('A member sees the usage charges by month', () => {
    setup([water, parking], 'member')
    expect(
      screen.getByRole('region', { name: 'Usage charges in 2026' }),
    ).toHaveTextContent('€458.00')
  })

  test('A flat without usage charges by month', () => {
    setup([])
    expect(screen.getByText('The flat has no usage charges.')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Add usage charges' }),
    ).toBeVisible()
  })
})
