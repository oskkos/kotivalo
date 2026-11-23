import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import type { Tenancy } from '#/features/tenancies/tenancy.repository.server'
import type { FlatDetails } from './details.server'
import { FlatDetailsPage } from './FlatDetailsPage'

// jsdom's browser language is English. Links render as plain anchors; the
// router isn't under test here.
vi.mock('@tanstack/react-router', () => ({
  createLink:
    () =>
    ({
      children,
      to,
      search,
    }: {
      children: ReactNode
      to: string
      search?: { year?: number }
    }) => (
      <a href={search?.year ? `${to}?year=${String(search.year)}` : to}>
        {children}
      </a>
    ),
}))
vi.mock('#/features/rent-payments/functions', () => ({}))

const aino: Tenancy = {
  id: 't1',
  propertyId: 'flat',
  tenantName: 'Aino Koski',
  tenantPhone: null,
  tenantEmail: null,
  contractType: 'open_ended',
  contractMade: '2025-02-12',
  validFrom: '2025-03-01',
  validTo: null,
  termEnd: null,
  dueDay: 5,
  noticeGivenBy: null,
  noticeDate: null,
}

const details = (over: Partial<FlatDetails> = {}): FlatDetails => ({
  role: 'owner',
  property: {
    id: 'flat',
    streetAddress: 'Kuusikuja 3 B 12',
    postcode: '33100',
    city: 'Tampere',
    roomCount: 2,
    floorArea: 485,
  },
  owners: [{ name: 'Annika', share: 10000, isYou: true }],
  today: '2026-11-22',
  tenancies: [aino],
  amounts: {
    rent: [{ validFrom: '2025-03-01', validTo: null, value: 89000 }],
    maintenance_charge: [],
    financing_charge: [],
  },
  financingCharges: [],
  treatments: [],
  capitalised: 0,
  // Every month to September paid; October and November not.
  payments: Array.from({ length: 19 }, (_, i) => {
    const month = new Date(Date.UTC(2025, 2 + i, 1)).toISOString().slice(0, 7)
    return {
      id: `p${String(i)}`,
      tenancyId: 't1',
      month,
      amount: 89000,
      paidOn: `${month}-03`,
      recordedBy: 'Annika',
    }
  }),
  latestEntries: [],
  ...over,
})

const renderPage = (view: FlatDetails) =>
  render(<FlatDetailsPage view={view} onChanged={() => Promise.resolve()} />)

describe('The flat details page', () => {
  test('shows the flat, the late rent and the one month not fully paid', () => {
    renderPage(details())
    expect(
      screen.getByRole('heading', { name: 'Kuusikuja 3 B 12' }),
    ).toBeVisible()
    expect(screen.getByText('33100 Tampere')).toBeVisible()
    const card = screen.getByRole('region', { name: 'November rent' })
    expect(card).toHaveTextContent('€890.00')
    expect(card).toHaveTextContent('17 days late')
    expect(
      within(card).getByRole('button', { name: 'Mark as paid' }),
    ).toBeVisible()
    expect(
      screen.getByText('Rent not recorded as fully paid: October 2026'),
    ).toBeVisible()
    expect(screen.getByText('No entries yet.')).toBeVisible()
  })

  test('a member gets no record button', () => {
    renderPage(details({ role: 'member' }))
    const card = screen.getByRole('region', { name: 'November rent' })
    expect(
      within(card).queryByRole('button', { name: 'Mark as paid' }),
    ).toBeNull()
  })

  test('a vacant flat shows when the last tenancy ended', () => {
    renderPage(
      details({
        tenancies: [
          {
            ...aino,
            validTo: '2026-08-31',
            termEnd: '2026-08-31',
            contractType: 'fixed_term',
          },
        ],
        payments: [],
      }),
    )
    expect(screen.getByText('The flat is vacant')).toBeVisible()
    expect(screen.queryByRole('region', { name: 'November rent' })).toBeNull()
  })

  test('the rent and charges show what is set', () => {
    renderPage(details())
    const amounts = screen.getByRole('region', { name: 'Rent and charges' })
    expect(amounts).toHaveTextContent('€890.00')
    expect(within(amounts).getAllByText('Not set')).toHaveLength(2)
  })
})

describe('Months not fully paid', () => {
  test("An earlier tenancy's month is warned about on the details page", () => {
    const pekka: Tenancy = {
      ...aino,
      id: 't0',
      tenantName: 'Pekka Virtanen',
      validFrom: '2024-01-01',
      validTo: '2026-11-10',
      noticeGivenBy: 'tenant',
      noticeDate: '2026-10-10',
    }
    const paid = (tenancyId: string, month: string) => ({
      id: `${tenancyId}-${month}`,
      tenancyId,
      month,
      amount: 89000,
      paidOn: `${month}-03`,
      recordedBy: 'Annika',
    })
    renderPage(
      details({
        tenancies: [{ ...aino, validFrom: '2026-11-15' }, pekka],
        payments: [
          ...Array.from({ length: 10 }, (_, i) =>
            paid('t0', `2026-${String(i + 1).padStart(2, '0')}`),
          ),
          ...Array.from({ length: 12 }, (_, i) =>
            paid('t0', `2025-${String(i + 1).padStart(2, '0')}`),
          ),
        ],
      }),
    )
    expect(screen.getByRole('region', { name: 'November rent' })).toBeVisible()
    expect(
      screen.getByText('Rent not recorded as fully paid: November 2026'),
    ).toBeVisible()
  })

  test('The warning opens the year of the newest month', () => {
    renderPage(
      details({
        payments: details().payments.filter((p) => p.month !== '2025-12'),
        today: '2026-09-22',
      }),
    )
    expect(
      screen
        .getByText('Rent not recorded as fully paid: December 2025')
        .closest('a'),
    ).toHaveAttribute('href', '/properties/$propertyId/rent?year=2025')
  })
})
