import { render, screen } from '@testing-library/react'
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

function setup(view: Partial<TenancyPageView>) {
  render(
    <TenancyPage
      view={{
        role: 'owner',
        today: '2026-11-22',
        tenancies: [aino],
        rentToday: 89000,
        ...view,
      }}
      address="Kuusikuja 3 B 12"
      onBack={vi.fn()}
      addAction={<button type="button">Add tenant</button>}
      currentActions={() => <button type="button">End tenancy</button>}
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
    expect(screen.queryByRole('link')).toBeNull()
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
      rentToday: null,
    })
    expect(screen.getByText('Starts 01/01/2027')).toBeVisible()
    expect(screen.getByText('31/12/2027')).toBeVisible()
    expect(screen.getByText('Not set')).toBeVisible()
  })
})
