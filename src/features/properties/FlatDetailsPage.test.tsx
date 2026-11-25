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
  archivedOn: null,
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
  tenancyRents: {
    t1: [{ validFrom: '2025-03-01', validTo: null, value: 89000 }],
    t0: [{ validFrom: '2024-01-01', validTo: null, value: 89000 }],
  },
  tenancyOccupants: {},
  tenancyFees: {},
  usageCharges: [],
  amounts: { maintenance_charge: [] },
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

const feesFixture = {
  t1: [
    {
      id: 'water',
      kind: 'water' as const,
      basis: 'per_occupant' as const,
      description: null,
      amounts: [{ validFrom: '2025-03-01', validTo: null, value: 2200 }],
    },
    {
      id: 'parking',
      kind: 'parking' as const,
      basis: 'fixed' as const,
      description: null,
      amounts: [{ validFrom: '2025-03-01', validTo: null, value: 1500 }],
    },
  ],
}
const twoOccupants = {
  t1: [{ validFrom: '2025-03-01', validTo: null, value: 2 }],
}

const renderPage = (view: FlatDetails) =>
  render(<FlatDetailsPage view={view} onChanged={() => Promise.resolve()} />)

describe('The flat details page', () => {
  test('The usage charges apart from the charges', () => {
    renderPage(
      details({
        today: '2026-11-24',
        tenancyOccupants: twoOccupants,
        amounts: {
          maintenance_charge: [
            { validFrom: '2025-03-01', validTo: null, value: 21400 },
          ],
        },
        usageCharges: [
          {
            id: 'water',
            kind: 'water',
            basis: 'per_occupant',
            description: null,
            periods: [{ validFrom: '2026-01-01', validTo: null, value: 2200 }],
          },
          {
            id: 'parking',
            kind: 'parking',
            basis: 'fixed',
            description: null,
            periods: [{ validFrom: '2026-02-01', validTo: null, value: 1500 }],
          },
        ],
      }),
    )
    const charges = screen.getByRole('region', { name: 'Charges' })
    expect(charges).not.toHaveTextContent('Water charge')
    const usage = screen.getByRole('region', { name: 'Usage charges' })
    expect(usage).toHaveTextContent(
      'Water charge€22.00/occupant · 2 occupants€44.00/month',
    )
    expect(usage).toHaveTextContent('Parking space€15.00/month')
    expect(
      within(usage).getByRole('link', { name: /Usage charges by month/ }),
    ).toHaveAttribute('href', expect.stringContaining('/usage-charges/months'))
  })

  test('A flat without usage charges on the details page', () => {
    renderPage(details())
    const usage = screen.getByRole('region', { name: 'Usage charges' })
    expect(usage).toHaveTextContent('The flat has no usage charges.')
    expect(within(usage).getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      expect.stringContaining('/usage-charges'),
    )
  })

  test('The rent card includes the tenant fees', () => {
    renderPage(
      details({
        today: '2026-11-24',
        tenancyFees: feesFixture,
        tenancyOccupants: twoOccupants,
      }),
    )
    const card = screen.getByRole('region', { name: 'November rent' })
    expect(card).toHaveTextContent('€949.00')
    expect(
      within(card).queryByRole('list', {
        name: 'Breakdown of the rent and fees',
      }),
    ).toBeNull()
    const tenancy = screen.getByRole('link', { name: /Aino Koski/ })
    expect(tenancy).toHaveTextContent('€890.00/month')
    expect(tenancy).toHaveTextContent('+ fees €59.00')
    expect(tenancy).toHaveTextContent('2 occupants')
  })

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

  test('the charges show what is set, without the rent', () => {
    renderPage(details())
    const amounts = screen.getByRole('region', { name: 'Charges' })
    expect(amounts).not.toHaveTextContent('€890.00')
    expect(within(amounts).getAllByText('Not set')).toHaveLength(2)
  })

  test('The tenancy card shows the rent and its upcoming change', () => {
    renderPage(
      details({
        tenancyRents: {
          t1: [
            { validFrom: '2026-03-01', validTo: '2027-02-28', value: 89000 },
            { validFrom: '2027-03-01', validTo: null, value: 92000 },
          ],
        },
      }),
    )
    const card = screen.getByRole('link', { name: /Aino Koski/ })
    expect(card).toHaveTextContent('€890.00/month')
    expect(card).toHaveTextContent('From 01/03/2027: €920.00')
  })

  test('Each financing charge in effect today', () => {
    const p = (validFrom: string, validTo: string | null, value: number) => ({
      validFrom,
      validTo,
      value,
    })
    renderPage(
      details({
        today: '2026-11-23',
        financingCharges: [
          {
            id: 'putki',
            name: 'Putkiremontti',
            periods: [p('2025-03-01', null, 8600)],
          },
          {
            id: 'julkisivu',
            name: 'Julkisivu',
            periods: [p('2026-01-01', null, 4200)],
          },
          {
            id: 'hissi',
            name: 'Hissiremontti',
            periods: [
              p('2025-03-01', '2025-12-31', 2400),
              p('2026-01-01', null, 0),
            ],
          },
        ],
        treatments: [
          { validFrom: '2025-03-01', validTo: null, value: 'capitalised' },
        ],
      }),
    )
    const amounts = screen.getByRole('region', { name: 'Charges' })
    expect(amounts).toHaveTextContent(
      'Financing chargePutkiremontti€86.00/month',
    )
    expect(amounts).toHaveTextContent('Financing chargeJulkisivu€42.00/month')
    expect(amounts).toHaveTextContent(
      'Treatment by the housing companyPlaced in reserve',
    )
    expect(amounts).not.toHaveTextContent('Hissiremontti')
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
