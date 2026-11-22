import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { TransactionForm } from './TransactionForm'

// jsdom's browser language is English, so the form is in English.
const createTransaction =
  vi.fn<(input: { data: FormData }) => Promise<unknown>>()
const updateTransaction =
  vi.fn<(input: { data: FormData }) => Promise<unknown>>()
const deleteTransaction = vi.fn<(input: unknown) => Promise<unknown>>()
vi.mock('./functions', () => ({
  createTransaction: (input: { data: FormData }) => createTransaction(input),
  updateTransaction: (input: { data: FormData }) => updateTransaction(input),
  deleteTransaction: (input: unknown) => deleteTransaction(input),
}))

const flat = (id: string, streetAddress: string) => ({
  id,
  streetAddress,
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2 as const,
  floorArea: 485,
})

const kuusikuja = flat('k', 'Kuusikuja 3 B 12')
const koivupolku = flat('p', 'Koivupolku 7 A 4')

function setup(options: { pickFlat?: boolean } = {}) {
  const user = userEvent.setup()
  const onSaved = vi.fn(() => Promise.resolve())
  render(
    <TransactionForm
      flats={options.pickFlat ? [koivupolku, kuusikuja] : [kuusikuja]}
      initialFlatId="k"
      pickFlat={options.pickFlat ?? false}
      today="2026-11-21"
      onSaved={onSaved}
      onClose={vi.fn()}
    />,
  )
  return { user, onSaved }
}

const hint = () => screen.getByRole('status')

beforeEach(() => {
  createTransaction.mockReset()
  updateTransaction.mockReset()
  deleteTransaction.mockReset()
})

describe('Entry categories', () => {
  test('The chosen category shows its tax hint', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Annual repair' }))
    expect(hint()).toHaveTextContent('Deductible expense')
    expect(hint()).toHaveTextContent('An improvement is not an annual repair.')
    await user.click(screen.getByRole('button', { name: 'Insurance' }))
    expect(hint()).toHaveTextContent(
      'Insurance premiums for the let flat are deductible.',
    )
  })

  test('An improvement is not deducted all at once', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Improvement' }))
    expect(hint()).toHaveTextContent('Not deducted all at once')
    expect(hint()).not.toHaveTextContent('Deductible')
    expect(hint()).toHaveTextContent(
      'a tenth a year for 10 years from the year paid, or only when the flat is sold.',
    )
  })

  test('Rent is not a category', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Income' }))
    const categories = screen.getByRole('group', { name: 'Category' })
    expect(categories).toHaveTextContent(
      'Water charges from the tenantOther income',
    )
    await user.click(screen.getByRole('button', { name: 'Other income' }))
    expect(hint()).toHaveTextContent('Taxable rental income')
    expect(hint()).toHaveTextContent("Rent isn't logged")
  })
})

describe('entry form', () => {
  test('saves the entry as form data and reports where it went', async () => {
    createTransaction.mockResolvedValue({ ok: true, transactionId: 't1' })
    const { user, onSaved } = setup()
    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '145,50')
    await user.clear(screen.getByRole('textbox', { name: 'Date' }))
    await user.type(screen.getByRole('textbox', { name: 'Date' }), '12/11/2026')
    await user.type(
      screen.getByRole('textbox', { name: 'Description' }),
      'Putkimies',
    )
    await user.click(screen.getByRole('button', { name: 'Save expense' }))
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith({
        propertyId: 'k',
        date: '2026-11-12',
      })
    })
    const data = createTransaction.mock.calls[0]?.[0].data ?? new FormData()
    expect(Object.fromEntries(data.entries())).toEqual({
      propertyId: 'k',
      type: 'expense',
      category: 'annual_repair',
      amount: '145,50',
      date: '12/11/2026',
      note: 'Putkimies',
    })
  })

  test('a future date is refused before sending', async () => {
    const { user } = setup()
    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '10')
    await user.clear(screen.getByRole('textbox', { name: 'Date' }))
    await user.type(screen.getByRole('textbox', { name: 'Date' }), '22/11/2026')
    await user.click(screen.getByRole('button', { name: 'Save expense' }))
    expect(
      await screen.findByText("The date can't be in the future."),
    ).toBeVisible()
    expect(createTransaction).not.toHaveBeenCalled()
  })

  test('a server field reason shows under its field', async () => {
    createTransaction.mockResolvedValue({
      ok: false,
      reason: 'transaction_date_before_ownership',
    })
    const { user } = setup()
    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '10')
    await user.click(screen.getByRole('button', { name: 'Save expense' }))
    expect(
      await screen.findByText(
        "The date can't be before the flat's ownership began.",
      ),
    ).toBeVisible()
  })
})

describe('Storage quota for receipts', () => {
  test('the quota alert shows and the receipt can be removed', async () => {
    createTransaction.mockResolvedValue({
      ok: false,
      reason: 'storage_quota_full',
    })
    const { user } = setup()
    await user.upload(
      screen.getByLabelText('Take a photo or choose a file'),
      new File(['%PDF-1.7'], 'kuitti.pdf', { type: 'application/pdf' }),
    )
    expect(screen.getByText('kuitti.pdf')).toBeVisible()
    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '10')
    await user.click(screen.getByRole('button', { name: 'Save expense' }))
    expect(await screen.findByText('Storage is full')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Remove the receipt' }))
    expect(screen.queryByText('kuitti.pdf')).toBeNull()
  })
})

describe('New entry from the bottom bar', () => {
  test('Choosing among owned flats', async () => {
    createTransaction.mockResolvedValue({ ok: true, transactionId: 't1' })
    const { user, onSaved } = setup({ pickFlat: true })
    await user.click(screen.getByRole('button', { name: /Flat/ }))
    const options = screen.getAllByRole('radio')
    expect(options.map((option) => option.textContent)).toEqual([
      'Koivupolku 7 A 4Tampere',
      'Kuusikuja 3 B 12Tampere',
    ])
    await user.click(screen.getByRole('radio', { name: /Koivupolku/ }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(screen.getByRole('button', { name: /Flat/ })).toHaveTextContent(
      'Koivupolku 7 A 4',
    )
    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '10')
    await user.click(screen.getByRole('button', { name: 'Save expense' }))
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ propertyId: 'p' }),
      )
    })
  })
})

const entry = {
  id: 't1',
  propertyId: 'k',
  type: 'expense' as const,
  category: 'annual_repair' as const,
  amount: 14550,
  date: '2026-11-12',
  note: 'Putkimies',
  createdBy: { id: 'annika', name: 'Annika' },
  createdAt: new Date(Date.UTC(2026, 10, 12)),
  receipt: {
    id: 'r1',
    contentType: 'image/jpeg',
    size: 421_888,
    filename: 'kuitti_hana.jpg',
    createdAt: new Date(Date.UTC(2026, 10, 12)),
  },
}

function setupEdit() {
  const user = userEvent.setup()
  const onSaved = vi.fn(() => Promise.resolve())
  const onDeleted = vi.fn(() => Promise.resolve())
  render(
    <TransactionForm
      flats={[kuusikuja]}
      initialFlatId="k"
      pickFlat={false}
      today="2026-11-21"
      editing={entry}
      onSaved={onSaved}
      onDeleted={onDeleted}
      onClose={vi.fn()}
    />,
  )
  return { user, onSaved, onDeleted }
}

describe('Editing an entry', () => {
  test('the form starts from the entry and keeps its receipt', async () => {
    updateTransaction.mockResolvedValue({ ok: true })
    const { user, onSaved } = setupEdit()
    expect(screen.getByRole('heading', { name: 'Edit entry' })).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveValue(
      '145.50',
    )
    expect(screen.getByText('kuitti_hana.jpg')).toBeVisible()
    await user.clear(screen.getByRole('textbox', { name: 'Amount' }))
    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '154.50')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled()
    })
    const data = updateTransaction.mock.calls[0]?.[0].data ?? new FormData()
    expect(data.get('amount')).toBe('154.50')
    expect(data.get('transactionId')).toBe('t1')
    expect(data.get('receiptAction')).toBe('keep')
  })

  test('removing the receipt sends remove', async () => {
    updateTransaction.mockResolvedValue({ ok: true })
    const { user } = setupEdit()
    await user.click(screen.getByRole('button', { name: 'Remove the receipt' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => {
      expect(updateTransaction).toHaveBeenCalled()
    })
    const data = updateTransaction.mock.calls[0]?.[0].data ?? new FormData()
    expect(data.get('receiptAction')).toBe('remove')
  })
})

describe('Deleting an entry', () => {
  test('Cancelling keeps the entry', async () => {
    const { user } = setupEdit()
    await user.click(screen.getByRole('button', { name: 'Delete entry' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete this entry?' })
    expect(dialog).toHaveTextContent(
      'Expense €145.50 (12/11/2026) and its receipt will be deleted permanently.',
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(deleteTransaction).not.toHaveBeenCalled()
  })

  test('confirming deletes the entry', async () => {
    deleteTransaction.mockResolvedValue({ ok: true })
    const { user, onDeleted } = setupEdit()
    await user.click(screen.getByRole('button', { name: 'Delete entry' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalled()
    })
    expect(deleteTransaction).toHaveBeenCalledWith({
      data: { propertyId: 'k', transactionId: 't1' },
    })
  })
})
