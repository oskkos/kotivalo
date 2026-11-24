import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { Tenancy } from './tenancy.repository.server'
import { TenancyPage, type TenancyPageView } from './TenancyPage'

// jsdom's browser language is English, so the page is in English.

const aino: Tenancy = {
  id: 't1',
  propertyId: 'flat',
  tenantName: 'Aino Koski',
  tenantPhone: '040 123 4567',
  tenantEmail: 'aino@example.com',
  contractType: 'open_ended',
  contractMade: '2025-02-12',
  validFrom: '2025-03-01',
  validTo: null,
  termEnd: null,
  dueDay: 5,
  noticeGivenBy: null,
  noticeDate: null,
}

const mikko: Tenancy = {
  ...aino,
  id: 't0',
  tenantName: 'Mikko Lehtinen',
  tenantPhone: null,
  tenantEmail: null,
  contractType: 'fixed_term',
  contractMade: '2023-05-20',
  validFrom: '2023-06-01',
  validTo: '2025-02-28',
  termEnd: '2025-02-28',
}

const onUndoRent = vi.fn()

function setup(view: Partial<TenancyPageView>) {
  render(
    <TenancyPage
      view={{
        role: 'owner',
        today: '2026-11-22',
        tenancies: [aino],
        rents: {
          [aino.id]: [{ validFrom: '2025-03-01', validTo: null, value: 89000 }],
        },
        ...view,
      }}
      address="Kuusikuja 3 B 12"
      onBack={vi.fn()}
      addAction={<button type="button">Add tenant</button>}
      currentActions={() => <button type="button">End tenancy</button>}
      rentChange={() => <a href="/rent">Change</a>}
      onUndoRent={onUndoRent}
    />,
  )
}

describe('tenancy page', () => {
  test('the current tenant with contact links and details', () => {
    setup({ tenancies: [aino, mikko] })
    expect(screen.getByRole('heading', { name: 'Aino Koski' })).toBeVisible()
    expect(screen.getByText('Active')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Call: 040 123 4567' }),
    ).toHaveAttribute('href', 'tel:0401234567')
    expect(
      screen.getByRole('link', { name: 'Send an email: aino@example.com' }),
    ).toHaveAttribute('href', 'mailto:aino@example.com')
    expect(screen.getByText('Open-ended')).toBeVisible()
    expect(screen.getByText('12/02/2025')).toBeVisible()
    expect(screen.getByText('€890.00 a month')).toBeVisible()
    expect(screen.getByText('day 5 of the month')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Other tenancies' }),
    ).toBeVisible()
    expect(screen.getByText('Mikko Lehtinen')).toBeVisible()
    expect(screen.getByText('End tenancy')).toBeVisible()
  })

  test('notice given shows the last rent day and the ending', () => {
    setup({
      tenancies: [
        {
          ...aino,
          validTo: '2026-12-31',
          noticeGivenBy: 'tenant',
          noticeDate: '2026-11-22',
        },
      ],
    })
    expect(screen.getByText('Notice given · ends 31/12/2026')).toBeVisible()
    expect(screen.getByText('31/12/2026')).toBeVisible()
    expect(screen.getByText("Tenant's notice, 22/11/2026")).toBeVisible()
  })

  test('a vacant flat with history says when the last tenancy ended', () => {
    setup({ tenancies: [mikko] })
    expect(
      screen.getByRole('heading', { name: 'The flat is vacant' }),
    ).toBeVisible()
    expect(
      screen.getByText(/The previous tenancy ended on 28\/02\/2025\./),
    ).toBeVisible()
    expect(screen.getByText('Add tenant')).toBeVisible()
    expect(screen.getByText('Mikko Lehtinen')).toBeVisible()
  })

  test('a vacant flat without history', () => {
    setup({ tenancies: [] })
    expect(screen.getByText(/The flat has no tenant yet\./)).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Other tenancies' }),
    ).toBeNull()
  })

  test('a member sees no actions', () => {
    setup({ role: 'member' })
    expect(screen.queryByText('End tenancy')).toBeNull()
    expect(
      screen.getByText('Only the owners can add, edit and end tenancies.'),
    ).toBeVisible()
  })

  test('a tenancy without phone or email has no contact links', () => {
    setup({ tenancies: [{ ...aino, tenantPhone: null, tenantEmail: null }] })
    const tenant = screen.getByRole('region', { name: 'Aino Koski' })
    expect(within(tenant).queryByRole('link')).toBeNull()
  })

  test('a fixed term to come shows when it starts and ends', () => {
    setup({
      tenancies: [
        {
          ...mikko,
          validFrom: '2027-01-01',
          validTo: '2027-12-31',
          termEnd: '2027-12-31',
        },
      ],
      rents: {},
    })
    expect(screen.getByText('Starts 01/01/2027')).toBeVisible()
    expect(screen.getByText('31/12/2027')).toBeVisible()
    expect(screen.getByText('Not set')).toBeVisible()
  })
})

describe('The tenancy page', () => {
  const rents = [
    { validFrom: '2025-03-01', validTo: '2026-02-28', value: 85000 },
    { validFrom: '2026-03-01', validTo: null, value: 89000 },
  ]

  test('The rent card with its changes', async () => {
    setup({ rents: { [aino.id]: rents } })
    const card = screen.getByRole('region', { name: 'Rent' })
    expect(card).toHaveTextContent('€890.00 a month')
    expect(card).toHaveTextContent('From 01/03/2026')
    const changes = within(card).getByRole('list', { name: 'Rent changes' })
    expect(
      within(changes)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['From 01/03/2026€890.00', 'From 01/03/2025€850.00'])
    expect(within(card).getByRole('link', { name: 'Change' })).toBeVisible()
    await userEvent.click(
      within(card).getByRole('button', { name: 'Undo the latest change' }),
    )
    expect(onUndoRent).toHaveBeenCalled()
  })

  test('an upcoming change shows below the rent', () => {
    setup({
      rents: {
        [aino.id]: [
          { validFrom: '2025-03-01', validTo: '2027-02-28', value: 89000 },
          { validFrom: '2027-03-01', validTo: null, value: 92000 },
        ],
      },
    })
    expect(screen.getByText('From 01/03/2027: €920.00/month')).toBeVisible()
  })

  test('the first rent alone offers no undo', () => {
    setup({})
    expect(
      screen.queryByRole('button', { name: 'Undo the latest change' }),
    ).toBeNull()
  })

  test('Other tenancies show their latest rent', () => {
    setup({
      tenancies: [aino, mikko],
      rents: {
        [mikko.id]: [{ validFrom: '2023-06-01', validTo: null, value: 82000 }],
      },
    })
    const others = screen.getByRole('region', { name: 'Other tenancies' })
    expect(others).toHaveTextContent('€820.00/month')
  })

  test('a member sees the rent card without the change and undo', () => {
    setup({ role: 'member', rents: { [aino.id]: rents } })
    const card = screen.getByRole('region', { name: 'Rent' })
    expect(card).toHaveTextContent('€890.00 a month')
    expect(within(card).queryByRole('link')).toBeNull()
    expect(within(card).queryByRole('button')).toBeNull()
  })
})
