import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { setFinancingTreatment } from './functions'
import type { RecurringAmountsView } from './recurring-amounts.server'
import { TreatmentForm } from './TreatmentForm'

// jsdom's browser language is English, so the form is in English.
vi.mock('#/lib/client-log', () => ({ clientLog: { error: vi.fn() } }))
vi.mock('./functions', () => ({ setFinancingTreatment: vi.fn() }))
const save = vi.mocked(setFinancingTreatment)

afterEach(() => {
  vi.clearAllMocks()
})

const view: RecurringAmountsView = {
  role: 'owner',
  today: '2026-11-21',
  ownershipStart: '2025-03-01',
  capitalised: 0,
  amounts: { rent: [], maintenance_charge: [], financing_charge: [] },
  treatments: [],
}

function setup(data = view) {
  const user = userEvent.setup()
  const onDone = vi.fn(() => Promise.resolve())
  render(
    <TreatmentForm
      propertyId="flat"
      view={data}
      address="Kuusikuja 3 B 12"
      onDone={onDone}
      onClose={vi.fn()}
    />,
  )
  return { user, onDone }
}

describe('The financing charge treatment', () => {
  test('choosing a treatment explains it, and saving sends it', async () => {
    save.mockResolvedValue({ ok: true })
    const { user, onDone } = setup()
    await user.click(screen.getByRole('button', { name: 'Placed in reserve' }))
    expect(
      screen.getByText(/added to the flat's acquisition cost/),
    ).toBeVisible()
    await user.type(
      screen.getByRole('textbox', { name: 'Valid from' }),
      '01/03/2025',
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(save).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        treatment: 'capitalised',
        from: '01/03/2025',
      },
    })
    expect(onDone).toHaveBeenCalled()
  })

  test('a treatment must be chosen', async () => {
    const { user } = setup()
    await user.type(
      screen.getByRole('textbox', { name: 'Valid from' }),
      '01/03/2025',
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Choose a treatment.')).toBeVisible()
    expect(save).not.toHaveBeenCalled()
  })

  test("the server's date reason is shown under the date", async () => {
    save.mockResolvedValue({
      ok: false,
      reason: 'amount_date_before_ownership',
    })
    const { user } = setup()
    await user.click(
      screen.getByRole('button', { name: 'Recorded as revenue' }),
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Valid from' }),
      '01/01/2025',
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      screen.getByText(
        "The date can't be before the month the flat's ownership began.",
      ),
    ).toBeVisible()
  })

  test('the history lists the treatments, newest first', () => {
    setup({
      ...view,
      treatments: [
        {
          validFrom: '2025-03-01',
          validTo: '2026-12-31',
          value: 'capitalised',
        },
        { validFrom: '2027-01-01', validTo: null, value: 'income_recognised' },
      ],
    })
    const rows = within(screen.getByRole('list', { name: 'History' }))
      .getAllByRole('listitem')
      .map((row) => row.textContent)
    expect(rows).toEqual([
      'From 01/01/2027Recorded as revenue',
      'From 01/03/2025Placed in reserve',
    ])
  })
})
