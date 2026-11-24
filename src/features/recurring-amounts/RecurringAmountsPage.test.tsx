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
  amounts: { maintenance_charge: [] },
  financingCharges: [],
  treatments: [],
}

const p = (validFrom: string, validTo: string | null, value: number) => ({
  validFrom,
  validTo,
  value,
})

const filled: RecurringAmountsView = {
  ...empty,
  capitalised: 131600,
  amounts: {
    maintenance_charge: [
      { validFrom: '2026-01-01', validTo: '2026-12-31', value: 21400 },
      { validFrom: '2027-01-01', validTo: null, value: 22600 },
    ],
  },
  financingCharges: [
    {
      id: 'unnamed',
      name: null,
      periods: [{ validFrom: '2025-03-01', validTo: null, value: 8600 }],
    },
  ],
  treatments: [
    { validFrom: '2025-03-01', validTo: null, value: 'capitalised' },
  ],
}

/** Putkiremontti and Julkisivu, Julkisivu rising next year. */
const several: RecurringAmountsView = {
  ...filled,
  financingCharges: [
    {
      id: 'putki',
      name: 'Putkiremontti',
      periods: [p('2025-03-01', null, 8600)],
    },
    {
      id: 'julkisivu',
      name: 'Julkisivu',
      periods: [
        p('2026-01-01', '2026-12-31', 4200),
        p('2027-01-01', null, 4500),
      ],
    },
  ],
}

function setup(view: RecurringAmountsView) {
  const user = userEvent.setup()
  const onEdit = vi.fn()
  const onEditCharge = vi.fn()
  const onAddCharge = vi.fn()
  render(
    <RecurringAmountsPage
      view={view}
      address="Kuusikuja 3 B 12"
      onBack={vi.fn()}
      onEdit={onEdit}
      onEditCharge={onEditCharge}
      onAddCharge={onAddCharge}
    />,
  )
  return { user, onEdit, onEditCharge, onAddCharge }
}

const section = (name: string) => screen.getByRole('region', { name })

describe('The charge amounts page', () => {
  test('A flat without amounts', () => {
    setup(empty)
    for (const name of ['Maintenance charge', 'Financing charge']) {
      expect(within(section(name)).getAllByText('Not set')[0]).toBeVisible()
    }
    expect(
      within(section('Financing charge')).getByText('No financing charges'),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Add financing charge' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Set: Maintenance charge' }),
    ).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Rent' })).toBeNull()
    expect(
      screen.getByText(
        /The rent belongs to the tenancy and is changed on the tenancy page\./,
      ),
    ).toBeVisible()
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
    setup({ ...several, role: 'member' })
    expect(
      within(section('Maintenance charge')).getByText('€214.00/month'),
    ).toBeVisible()
    expect(
      within(section('Financing charges')).getByText('Putkiremontti'),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: /^(Set|Change):/ })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Add financing charge' }),
    ).toBeNull()
    expect(
      screen.getByText(/^Only owners can change the amounts\./),
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
    await user.click(
      screen.getByRole('button', { name: 'Change: Maintenance charge' }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Change: Treatment by the housing company',
      }),
    )
    expect(onEdit.mock.calls).toEqual([['maintenance_charge'], ['treatment']])
  })

  test('Several financing charges with their sum', () => {
    setup(several)
    const financing = section('Financing charges')
    expect(financing).toHaveTextContent('€128.00/month in total')
    const rows = within(financing).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent(
      'Putkiremontti€86.00/monthFrom 01/03/2025',
    )
    expect(rows[1]).toHaveTextContent(
      'Julkisivu€42.00/monthFrom 01/01/2026ChangeFrom 01/01/2027: €45.00/month',
    )
    expect(
      within(financing).getByText(
        'Treatment by the housing company · applies to all',
      ),
    ).toBeVisible()
  })

  test('one unnamed charge looks as before', () => {
    setup(filled)
    const financing = section('Financing charge')
    expect(within(financing).getByText('€86.00/month')).toBeVisible()
    expect(
      within(financing).queryByText('in total', { exact: false }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Change: Financing charge' }),
    ).toBeVisible()
  })

  test('a charge that starts later shows its first amount', () => {
    setup({
      ...empty,
      financingCharges: [
        { id: 'c', name: 'Julkisivu', periods: [p('2027-01-01', null, 4200)] },
      ],
    })
    const financing = section('Financing charge')
    expect(within(financing).getByText('€42.00/month')).toBeVisible()
    expect(within(financing).getByText('From 01/01/2027')).toBeVisible()
  })

  test('the charge buttons open their forms', async () => {
    const { user, onEditCharge, onAddCharge } = setup(several)
    await user.click(screen.getByRole('button', { name: 'Change: Julkisivu' }))
    await user.click(
      screen.getByRole('button', { name: 'Add financing charge' }),
    )
    expect(onEditCharge).toHaveBeenCalledWith('julkisivu')
    expect(onAddCharge).toHaveBeenCalled()
  })

  test('ended charges are listed below the card', async () => {
    const { user, onEditCharge } = setup({
      ...several,
      financingCharges: [
        ...several.financingCharges,
        {
          id: 'hissi',
          name: 'Hissiremontti',
          periods: [
            p('2025-03-01', '2025-12-31', 2400),
            p('2026-01-01', null, 0),
          ],
        },
      ],
    })
    expect(
      within(section('Financing charges')).queryByText('Hissiremontti'),
    ).toBeNull()
    const ended = section('Ended financing charges')
    expect(ended).toHaveTextContent(
      'HissiremonttiEnded 31/12/2025 · was €24.00/month',
    )
    await user.click(within(ended).getByRole('button'))
    expect(onEditCharge).toHaveBeenCalledWith('hissi')
  })
})
