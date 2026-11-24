import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { FinancingChargeForm } from './FinancingChargeForm'
import { addFinancingCharge } from './functions'
import type { RecurringAmountsView } from './recurring-amounts.server'

// jsdom's browser language is English, so the form is in English.

vi.mock('#/lib/client-log', () => ({ clientLog: { error: vi.fn() } }))
vi.mock('./functions', () => ({ addFinancingCharge: vi.fn() }))
const add = vi.mocked(addFinancingCharge)

afterEach(() => {
  vi.clearAllMocks()
})

const view: RecurringAmountsView = {
  role: 'owner',
  today: '2026-11-23',
  ownershipStart: '2025-03-01',
  capitalised: 0,
  amounts: { maintenance_charge: [] },
  financingCharges: [],
  treatments: [
    { validFrom: '2025-03-01', validTo: null, value: 'capitalised' },
  ],
}

function setup(data = view) {
  const user = userEvent.setup()
  const onDone = vi.fn(() => Promise.resolve())
  render(
    <FinancingChargeForm
      propertyId="flat"
      view={data}
      address="Kuusikuja 3 B 12"
      onDone={onDone}
      onClose={vi.fn()}
    />,
  )
  return { user, onDone }
}

async function fill(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByRole('textbox', { name: 'Name' }), name)
  await user.type(
    screen.getByRole('textbox', { name: 'Amount (€/month)' }),
    '42',
  )
  await user.type(
    screen.getByRole('textbox', { name: 'Valid from' }),
    '01/01/2026',
  )
}

describe('Adding a financing charge', () => {
  test('the form says the treatment applies to the new charge too', () => {
    setup()
    expect(
      screen.getByText(
        'The treatment is set for the whole flat and applies to all its financing charges, this one too: “Placed in reserve” from 01/03/2025.',
      ),
    ).toBeVisible()
  })

  test('without a treatment the note says it is not set', () => {
    setup({ ...view, treatments: [] })
    expect(
      screen.getByText(
        "The treatment is set for the whole flat and applies to all its financing charges, this one too. It isn't set yet.",
      ),
    ).toBeVisible()
  })

  test('adding sends the name, amount and date as typed', async () => {
    add.mockResolvedValue({ ok: true, chargeId: 'c1' })
    const { user, onDone } = setup()
    await fill(user, 'Julkisivu')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(add).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        name: 'Julkisivu',
        amount: '42',
        from: '01/01/2026',
      },
    })
    expect(onDone).toHaveBeenCalled()
  })

  test("the server's name reason is shown under the name", async () => {
    add.mockResolvedValue({ ok: false, reason: 'financing_charge_name_taken' })
    const { user, onDone } = setup()
    await fill(user, 'Putkiremontti')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(
      await screen.findByText(
        'The flat already has a financing charge with this name.',
      ),
    ).toBeVisible()
    expect(onDone).not.toHaveBeenCalled()
  })
})
