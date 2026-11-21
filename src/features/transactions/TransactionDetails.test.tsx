import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { TransactionDetails as Entry } from './transaction.repository.server'
import { TransactionDetails } from './TransactionDetails'

// jsdom's browser language is English, so the page is in English. The page
// imports signedAmount from the entries page, which uses router links.
vi.mock('@tanstack/react-router', () => ({ createLink: () => () => null }))

const property = {
  id: 'flat',
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2 as const,
  floorArea: 485,
}

const expense: Entry = {
  id: 'e1',
  propertyId: 'flat',
  type: 'expense',
  category: 'annual_repair',
  amount: 14550,
  date: '2026-11-12',
  note: 'Putkimies, keittiön hana',
  createdBy: { id: 'annika', name: 'Annika' },
  createdAt: new Date(Date.UTC(2026, 10, 12, 10)),
  receipt: {
    id: 'r1',
    contentType: 'image/jpeg',
    size: 421_888,
    filename: 'kuitti_hana.jpg',
    createdAt: new Date(Date.UTC(2026, 10, 12, 10)),
  },
}

function setup(
  entry: Entry,
  options: { role?: 'owner' | 'member'; loggedByYou?: boolean } = {},
) {
  render(
    <TransactionDetails
      entry={entry}
      property={property}
      role={options.role ?? 'owner'}
      loggedByYou={options.loggedByYou ?? true}
      onBack={vi.fn()}
      editAction={<button type="button">Edit</button>}
    />,
  )
  return userEvent.setup()
}

describe('Entry details', () => {
  test('The details of an expense', () => {
    setup(expense)
    expect(screen.getByText('-€145.50')).toBeVisible()
    expect(screen.getByText('Annual repair')).toBeVisible()
    expect(screen.getByText('Deductible')).toBeVisible()
    expect(screen.getByText('12/11/2026')).toBeVisible()
    expect(screen.getByText('2026 · Expenses for annual repairs')).toBeVisible()
    expect(screen.getByText('You, 12/11/2026')).toBeVisible()
    expect(screen.getByText('kuitti_hana.jpg · 412 kB')).toBeVisible()
  })

  test('An entry logged by a co-owner', () => {
    setup(
      { ...expense, createdBy: { id: 'jussi', name: 'Jussi' } },
      { loggedByYou: false },
    )
    expect(screen.getByText('Jussi, 12/11/2026')).toBeVisible()
  })
})

describe('entry details', () => {
  test('an income without a receipt', () => {
    setup({
      ...expense,
      type: 'income',
      category: 'tenant_water_charge',
      amount: 4000,
      receipt: null,
    })
    expect(screen.getByRole('heading', { name: 'Income' })).toBeVisible()
    expect(screen.getByText('+€40.00')).toBeVisible()
    expect(screen.getByText('Taxable')).toBeVisible()
    expect(screen.getByText('2026 · Gross rental income')).toBeVisible()
    expect(screen.getByText('This entry has no receipt.')).toBeVisible()
    expect(screen.queryByRole('link', { name: /Download/ })).toBeNull()
  })

  test('a member gets Download but not Edit', () => {
    setup(expense, { role: 'member' })
    expect(
      screen.getByRole('link', { name: 'Download the receipt' }),
    ).toHaveAttribute('href', '/api/receipts/r1?download=1')
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })

  test('the receipt opens full screen with Close and Download', async () => {
    const user = setup(expense)
    await user.click(
      screen.getByRole('button', { name: 'Open the receipt full screen' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Receipt' })
    expect(dialog).toBeVisible()
    expect(
      screen.getByRole('img', { name: 'Receipt kuitti_hana.jpg' }),
    ).toHaveAttribute('src', '/api/receipts/r1')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  test("a PDF opens in the browser's viewer", () => {
    setup({
      ...expense,
      receipt: {
        id: 'r2',
        contentType: 'application/pdf',
        size: 300_000,
        filename: 'kuitti.pdf',
        createdAt: new Date(Date.UTC(2026, 10, 12, 10)),
      },
    })
    expect(
      screen.getByRole('link', { name: 'Open the PDF receipt' }),
    ).toHaveAttribute('target', '_blank')
  })
})
