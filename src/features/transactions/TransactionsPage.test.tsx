import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType, ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import type { TransactionRow } from './transaction.repository.server'
import type { TransactionsView } from './transactions.server'
import { byMonth, TransactionsPage } from './TransactionsPage'

// jsdom's browser language is English, so the page is in English. Links
// need a router; the linked component with the resolved path is enough.
vi.mock('@tanstack/react-router', () => ({
  createLink:
    (Component: ComponentType<{ href: string; children?: ReactNode }>) =>
    ({
      to,
      params,
      ...rest
    }: {
      to: string
      params?: Record<string, string>
      children?: ReactNode
    }) => (
      <Component
        {...rest}
        href={Object.entries(params ?? {}).reduce(
          (path, [key, value]) => path.replace(`$${key}`, value),
          to,
        )}
      />
    ),
}))

const entry = (
  id: string,
  date: string,
  fields: Partial<TransactionRow> = {},
): TransactionRow => ({
  id,
  type: 'expense',
  category: 'annual_repair',
  amount: 14550,
  date,
  note: null,
  hasReceipt: false,
  ...fields,
})

const entries = [
  entry('a', '2026-11-12', {
    note: 'Putkimies, keittiön hana',
    hasReceipt: true,
  }),
  entry('b', '2026-11-03', {
    type: 'income',
    category: 'tenant_water_charge',
    amount: 4000,
  }),
  entry('c', '2026-10-28', { category: 'insurance', amount: 18600 }),
]

const view = (fields: Partial<TransactionsView> = {}): TransactionsView => ({
  role: 'owner',
  property: {
    id: 'flat',
    streetAddress: 'Kuusikuja 3 B 12',
    postcode: '33100',
    city: 'Tampere',
    roomCount: 2,
    floorArea: 485,
  },
  year: 2026,
  years: [2026, 2025],
  entries,
  totals: { income: 4000, expense: 33150 },
  ...fields,
})

function setup(value: TransactionsView) {
  const user = userEvent.setup()
  const onYear = vi.fn()
  render(<TransactionsPage view={value} onBack={vi.fn()} onYear={onYear} />)
  return { user, onYear }
}

describe('The entries page', () => {
  test('Entries are grouped by month, newest first', () => {
    setup(view())
    const totals = screen.getByRole('region', {
      name: "Totals of the year's entries",
    })
    expect(totals).toHaveTextContent('Income+€40.00')
    expect(totals).toHaveTextContent('Expenses-€331.50')
    const november = within(
      screen.getByRole('region', { name: 'November 2026' }),
    ).getAllByRole('listitem')
    expect(november.map((row) => row.textContent)).toEqual([
      'Annual repair12/11 · Putkimies, keittiön hana-€145.50',
      'Water charges from the tenant03/11+€40.00',
    ])
    expect(
      within(november[0] ?? document.body).getByRole('img', {
        name: 'Receipt attached',
      }),
    ).toBeVisible()
    expect(
      within(screen.getByRole('region', { name: 'October 2026' })).getByText(
        'Insurance',
      ),
    ).toBeVisible()
  })

  test('Choosing an earlier year', async () => {
    const { user, onYear } = setup(view())
    expect(screen.getByRole('button', { name: '2026' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: '2025' }))
    expect(onYear).toHaveBeenCalledWith(2025)
  })

  test('A flat without entries', () => {
    setup(
      view({ entries: [], years: [2026], totals: { income: 0, expense: 0 } }),
    )
    expect(
      screen.getByRole('heading', { name: 'No entries for 2026' }),
    ).toBeVisible()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  test("A member sees the entries but can't add them", () => {
    setup(view({ role: 'member' }))
    expect(screen.getByText('Annual repair')).toBeVisible()
    expect(
      screen.getByText(/Only the owners can add and edit entries/),
    ).toBeVisible()
    expect(screen.queryByRole('link', { name: /New entry/ })).toBeNull()
  })

  test('the note links to the charges page', () => {
    setup(view())
    expect(screen.getByRole('link', { name: 'Charges' })).toHaveAttribute(
      'href',
      '/properties/flat/amounts',
    )
  })
})

describe('byMonth', () => {
  test('keeps the order and starts a group per month', () => {
    expect(
      byMonth(entries).map((group) => [group.key, group.entries.length]),
    ).toEqual([
      ['2026-11', 2],
      ['2026-10', 1],
    ])
  })
})
