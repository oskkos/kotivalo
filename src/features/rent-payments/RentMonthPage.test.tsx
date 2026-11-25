import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Tenancy } from '#/features/tenancies/tenancy.repository.server'
import { RecordPaymentDialog } from './RecordPaymentDialog'
import { RentMonthPage, type RentMonthView } from './RentMonthPage'

// jsdom's browser language is English, so the page is in English.
const recordRentPayment =
  vi.fn<(input: { data: unknown }) => Promise<unknown>>()
const deleteRentPayment =
  vi.fn<(input: { data: unknown }) => Promise<unknown>>()
vi.mock('./functions', () => ({
  recordRentPayment: (input: { data: unknown }) => recordRentPayment(input),
  deleteRentPayment: (input: { data: unknown }) => deleteRentPayment(input),
}))

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

const view = (over: Partial<RentMonthView> = {}): RentMonthView => ({
  role: 'owner',
  today: '2026-11-22',
  tenancy: aino,
  month: '2026-11',
  rents: { t1: [{ validFrom: '2025-03-01', validTo: null, value: 89000 }] },
  occupants: {},
  fees: {},
  payments: [
    {
      id: 'p1',
      tenancyId: 't1',
      month: '2026-11',
      amount: 50000,
      paidOn: '2026-11-04',
      recordedBy: 'Annika',
    },
  ],
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

function renderPage(v = view()) {
  const onChanged = vi.fn(() => Promise.resolve())
  render(
    <RentMonthPage
      view={v}
      propertyId="flat"
      address="Kuusikuja 3 B 12"
      onBack={vi.fn()}
      onChanged={onChanged}
    />,
  )
  return { user: userEvent.setup(), onChanged }
}

beforeEach(() => {
  recordRentPayment.mockReset()
  deleteRentPayment.mockReset()
})

describe("The month's rent payments page", () => {
  test('The breakdown of the rent and the fees', () => {
    renderPage(view({ fees: feesFixture, occupants: twoOccupants }))
    const summary = screen.getByRole('region', { name: "The month's rent" })
    expect(summary).toHaveTextContent('Rent€949.00')
    expect(summary).toHaveTextContent('Paid€500.00')
    expect(summary).toHaveTextContent('Outstanding€449.00')
    const breakdown = within(summary).getByRole('list', {
      name: 'Breakdown of the rent and fees',
    })
    expect(
      within(breakdown)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Rent€890.00',
      'Water charge · 2 × €22.00€44.00',
      'Parking space€15.00',
      'The fees on the tenancy page',
    ])
    expect(
      within(breakdown).getByRole('link', {
        name: 'The fees on the tenancy page',
      }),
    ).toHaveAttribute('href', '/properties/flat/tenancy')
  })

  test('The rent and the fees as one payment', async () => {
    const { user } = renderPage(
      view({ fees: feesFixture, occupants: twoOccupants, payments: [] }),
    )
    await user.click(
      screen.getByRole('button', {
        name: /Record payment|Mark as paid|Add payment/,
      }),
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('textbox', { name: /Amount/ })).toHaveValue(
      '949.00',
    )
    expect(
      within(dialog).getByText(
        'The rent and the fees on top of the rent are recorded as one payment.',
      ),
    ).toBeVisible()
  })

  test('a month without fees shows no breakdown', () => {
    renderPage()
    expect(
      screen.queryByRole('list', { name: 'Breakdown of the rent and fees' }),
    ).toBeNull()
  })

  test("The month's payments", () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'November rent' })).toBeVisible()
    expect(screen.getByText('Kuusikuja 3 B 12 · Aino Koski')).toBeVisible()
    expect(screen.getByText('Due 05/11/2026')).toBeVisible()
    expect(screen.getByText('Partly paid')).toBeVisible()
    const summary = screen.getByRole('region', { name: "The month's rent" })
    expect(summary).toHaveTextContent('Rent€890.00')
    expect(summary).toHaveTextContent('Paid€500.00')
    expect(summary).toHaveTextContent('Outstanding€390.00')
    expect(
      screen.getByText('Paid 04/11/2026 · recorded by Annika'),
    ).toBeVisible()
  })

  test("A member sees the payments but can't change them", () => {
    renderPage(view({ role: 'member' }))
    expect(
      screen.getByText('Paid 04/11/2026 · recorded by Annika'),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Add payment' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: /Delete the payment/ }),
    ).toBeNull()
    expect(
      screen.getByText('Only owners can record and delete payments.'),
    ).toBeVisible()
  })

  test('a month without payments says so', () => {
    renderPage(view({ payments: [] }))
    expect(screen.getByText('No payments recorded.')).toBeVisible()
    expect(screen.getByText('17 days late')).toBeVisible()
  })
})

describe('Deleting a rent payment', () => {
  test('deletes a payment after the confirmation', async () => {
    deleteRentPayment.mockResolvedValue({ ok: true })
    const { user, onChanged } = renderPage()
    await user.click(
      screen.getByRole('button', {
        name: 'Delete the payment of €500.00, 04/11/2026',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete the payment?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalled()
    })
    expect(deleteRentPayment).toHaveBeenCalledWith({
      data: { propertyId: 'flat', paymentId: 'p1' },
    })
  })
})

describe('Recording a rent payment', () => {
  function renderDialog(missing: number | undefined) {
    const onDone = vi.fn(() => Promise.resolve())
    render(
      <RecordPaymentDialog
        propertyId="flat"
        tenancy={aino}
        month="2026-11"
        missing={missing}
        today="2026-11-22"
        open
        onClose={vi.fn()}
        onDone={onDone}
      />,
    )
    return { user: userEvent.setup(), onDone }
  }

  test('defaults to the missing amount and today', async () => {
    recordRentPayment.mockResolvedValue({ ok: true, paymentId: 'p2' })
    const { user, onDone } = renderDialog(39000)
    expect(
      screen.getByRole('dialog', { name: 'November rent paid' }),
    ).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Amount (€)' })).toHaveValue(
      '390.00',
    )
    expect(screen.getByRole('textbox', { name: 'Payment date' })).toHaveValue(
      '22/11/2026',
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
    expect(recordRentPayment).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        tenancyId: 't1',
        month: '2026-11',
        amount: '390.00',
        paidOn: '22/11/2026',
      },
    })
  })

  test('A payment date in the future is refused', async () => {
    recordRentPayment.mockResolvedValue({
      ok: false,
      reason: 'rent_payment_date_in_future',
    })
    const { user } = renderDialog(39000)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText("The payment date can't be in the future."),
    ).toBeVisible()
  })

  test('the amount is empty without a rent', () => {
    renderDialog(undefined)
    expect(screen.getByRole('textbox', { name: 'Amount (€)' })).toHaveValue('')
  })
})
