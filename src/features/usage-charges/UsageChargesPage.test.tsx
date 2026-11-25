import { render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { UsageChargePeriods } from './months'
import { UsageChargesPage } from './UsageChargesPage'

// jsdom's browser language is English, so the page is in English.

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
  occupants: [{ validFrom: '2025-03-01', validTo: null, value: 2 }],
}

function setup(
  charges: UsageChargePeriods[],
  role: 'owner' | 'member' = 'owner',
) {
  render(
    <UsageChargesPage
      view={{ role, today: '2026-11-24', charges, tenancies: [aino] }}
      address="Kuusikuja 3 B 12"
      onBack={vi.fn()}
      add={<a href="/new">Add a usage charge</a>}
      change={(c) => <a href={`/c/${c.id}`}>Change</a>}
    />,
  )
}

describe('The usage charges page', () => {
  test('The usage charges in effect today', () => {
    setup([water, parking])
    const list = screen.getByRole('list', { name: 'Usage charges' })
    const [first, second] = within(list).getAllByRole('listitem')
    expect(first).toHaveTextContent('Water charge')
    expect(first).toHaveTextContent('€44.00/month')
    expect(first).toHaveTextContent('€22.00/occupant/month · 2 occupants')
    expect(second).toHaveTextContent('Parking space')
    expect(second).toHaveTextContent('€15.00/month')
    expect(second).toHaveTextContent('From 01/02/2026')
    expect(within(list).getAllByRole('link', { name: 'Change' })).toHaveLength(
      2,
    )
    expect(
      screen.getByRole('link', { name: 'Add a usage charge' }),
    ).toBeVisible()
  })

  test('Other shows its description', () => {
    setup([
      {
        ...parking,
        id: 'other',
        kind: 'other',
        description: 'Pyykkitupa',
        periods: [{ validFrom: '2026-01-01', validTo: null, value: 1000 }],
      },
    ])
    expect(screen.getByText('Pyykkitupa')).toBeVisible()
    expect(screen.getByText('€10.00/month')).toBeVisible()
  })

  test('An ended usage charge is listed apart', () => {
    setup([
      water,
      {
        ...parking,
        id: 'sauna',
        kind: 'sauna',
        periods: [
          { validFrom: '2025-03-01', validTo: '2026-05-31', value: 1200 },
          { validFrom: '2026-06-01', validTo: null, value: 0 },
        ],
      },
    ])
    const ended = screen.getByRole('region', { name: 'Ended usage charges' })
    expect(ended).toHaveTextContent('Sauna')
    expect(ended).toHaveTextContent(/Ended 31\/05\/2026/)
    expect(
      within(screen.getByRole('list', { name: 'Usage charges' })).queryByText(
        'Sauna',
      ),
    ).toBeNull()
  })

  test('A flat without usage charges', () => {
    setup([])
    expect(screen.getByText('The flat has no usage charges.')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Add a usage charge' }),
    ).toBeVisible()
  })

  test("A member sees the usage charges but can't change them", () => {
    setup([water], 'member')
    expect(screen.getByText('Water charge')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Change' })).toBeNull()
    expect(
      screen.queryByRole('link', { name: 'Add a usage charge' }),
    ).toBeNull()
  })

  test('an upcoming change per occupant', () => {
    setup([
      {
        ...water,
        periods: [
          { validFrom: '2026-01-01', validTo: '2026-12-31', value: 2200 },
          { validFrom: '2027-01-01', validTo: null, value: 2400 },
        ],
      },
    ])
    expect(
      screen.getByText('From 01/01/2027: €24.00/occupant/month'),
    ).toBeVisible()
  })
})
