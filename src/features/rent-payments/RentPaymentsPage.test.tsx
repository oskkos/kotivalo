import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import type { Tenancy } from '#/features/tenancies/tenancy.repository.server'
import {
  RentPaymentsPage,
  rentYears,
  type RentPaymentsPageView,
} from './RentPaymentsPage'

// Links render as plain anchors; the router isn't under test here.
vi.mock('@tanstack/react-router', () => ({
  createLink:
    () => (props: { children: ReactNode; params: Record<string, string> }) => (
      <a href={`/month/${props.params.month}`}>{props.children}</a>
    ),
}))

const aino: Tenancy = {
  id: 't1',
  propertyId: 'flat',
  tenantName: 'Aino Koski',
  tenantPhone: null,
  tenantEmail: null,
  contractType: 'open_ended',
  contractMade: '2025-09-01',
  validFrom: '2025-10-01',
  validTo: null,
  termEnd: null,
  dueDay: 5,
  noticeGivenBy: null,
  noticeDate: null,
}

const view: RentPaymentsPageView = {
  today: '2026-01-20',
  tenancies: [aino],
  rents: { t1: [{ validFrom: '2025-10-01', validTo: null, value: 89000 }] },
  payments: [
    {
      id: 'p1',
      tenancyId: 't1',
      month: '2025-10',
      amount: 89000,
      paidOn: '2025-10-03',
      recordedBy: 'Annika',
    },
    {
      id: 'p2',
      tenancyId: 't1',
      month: '2025-12',
      amount: 89000,
      paidOn: '2026-01-02',
      recordedBy: 'Annika',
    },
  ],
}

function renderPage(year?: number) {
  const onYear = vi.fn()
  render(
    <RentPaymentsPage
      view={view}
      propertyId="flat"
      address="Kuusikuja 3 B 12"
      year={year}
      onBack={vi.fn()}
      onYear={onYear}
    />,
  )
  return { onYear }
}

describe('The rent payments page', () => {
  test('lists the months up to today with the rent received this year', () => {
    renderPage()
    expect(
      screen.getByRole('region', { name: 'Rent received in 2026' }),
    ).toHaveTextContent('€890.00')
    const months = within(screen.getByRole('list', { name: 'Months' }))
    expect(months.getAllByRole('listitem')).toHaveLength(1)
    expect(months.getByText('January')).toBeVisible()
    expect(screen.getByRole('note')).toHaveTextContent('January 2026')
  })

  test('the previous year shows its months and its unpaid month', () => {
    renderPage(2025)
    const items = within(
      screen.getByRole('list', { name: 'Months' }),
    ).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('December'),
      expect.stringContaining('November'),
      expect.stringContaining('October'),
    ])
    expect(screen.getByRole('note')).toHaveTextContent('November 2025')
    expect(
      screen.getByRole('region', { name: 'Rent received in 2025' }),
    ).toHaveTextContent('€890.00')
  })

  test('choosing a year asks for it', async () => {
    const { onYear } = renderPage()
    await userEvent.setup().click(screen.getByRole('button', { name: '2025' }))
    expect(onYear).toHaveBeenCalledWith(2025)
  })

  test('the years are those in which a tenancy ran', () => {
    expect(rentYears([aino], [], '2026-01-20')).toEqual([2026, 2025])
    expect(rentYears([], [], '2026-01-20')).toEqual([])
  })

  test('Rent paid in advance before the tenancy', () => {
    const fromJanuary = { ...aino, validFrom: '2026-01-01' }
    expect(
      rentYears([fromJanuary], [{ paidOn: '2025-12-28' }], '2026-01-20'),
    ).toEqual([2026, 2025])
  })
})
