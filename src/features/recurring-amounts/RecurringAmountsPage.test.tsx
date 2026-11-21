import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { RecurringAmountsPage } from './RecurringAmountsPage'
import type { RecurringAmountsView } from './recurring-amounts.server'

// jsdom's browser language is English, so the page is in English.

const empty: RecurringAmountsView = {
  role: 'owner',
  today: '2026-11-21',
  ownershipStart: '2025-03-01',
  capitalised: 0,
  amounts: { rent: [], maintenance_charge: [], financing_charge: [] },
  treatments: [],
}

const filled: RecurringAmountsView = {
  ...empty,
  capitalised: 131600,
  amounts: {
    rent: [{ validFrom: '2025-03-01', validTo: null, value: 89000 }],
    maintenance_charge: [
      { validFrom: '2026-01-01', validTo: '2026-12-31', value: 21400 },
      { validFrom: '2027-01-01', validTo: null, value: 22600 },
    ],
    financing_charge: [{ validFrom: '2025-03-01', validTo: null, value: 8600 }],
  },
  treatments: [
    { validFrom: '2025-03-01', validTo: null, value: 'capitalised' },
  ],
}

function setup(view: RecurringAmountsView) {
  const user = userEvent.setup()
  const onEdit = vi.fn()
  render(
    <RecurringAmountsPage
      view={view}
      address="Kuusikuja 3 B 12"
      onBack={vi.fn()}
      onEdit={onEdit}
    />,
  )
  return { user, onEdit }
}

const section = (name: string) => screen.getByRole('region', { name })

describe('The rent and charges page', () => {
  test('A flat without amounts', () => {
    setup(empty)
    for (const name of ['Rent', 'Maintenance charge', 'Financing charge']) {
      expect(within(section(name)).getAllByText('Not set')[0]).toBeVisible()
    }
    expect(screen.getByRole('button', { name: 'Set: Rent' })).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: 'Set: Treatment by the housing company',
      }),
    ).toBeVisible()
    expect(screen.queryByText(/acquisition cost so far/)).toBeNull()
  })

  test('The current amount and an upcoming change', () => {
    setup(filled)
    const maintenance = section('Maintenance charge')
    expect(within(maintenance).getByText('€214.00/month')).toBeVisible()
    expect(within(maintenance).getByText('From 01/01/2026')).toBeVisible()
    expect(
      within(maintenance).getByText('From 01/01/2027: €226.00/month'),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Change: Maintenance charge' }),
    ).toBeVisible()
  })

  test("A member sees the amounts but can't change them", () => {
    setup({ ...filled, role: 'member' })
    expect(within(section('Rent')).getByText('€890.00/month')).toBeVisible()
    expect(screen.queryByRole('button', { name: /^(Set|Change):/ })).toBeNull()
    expect(
      screen.getByText('Only owners can change the amounts.'),
    ).toBeVisible()
  })

  test('the treatment and the capitalised charges are shown', () => {
    setup(filled)
    const financing = section('Financing charge')
    expect(within(financing).getByText('Placed in reserve')).toBeVisible()
    expect(
      screen.getByText(
        '€1,316.00 of financing charges has been added to the acquisition cost so far. It counts when the flat is sold.',
      ),
    ).toBeVisible()
  })

  test('the buttons open the forms', async () => {
    const { user, onEdit } = setup(filled)
    await user.click(screen.getByRole('button', { name: 'Change: Rent' }))
    await user.click(
      screen.getByRole('button', {
        name: 'Change: Treatment by the housing company',
      }),
    )
    expect(onEdit.mock.calls).toEqual([['rent'], ['treatment']])
  })
})
