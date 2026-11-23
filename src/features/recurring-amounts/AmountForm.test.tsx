import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AmountForm } from './AmountForm'
import {
  renameFinancingCharge,
  setRecurringAmount,
  undoRecurringAmount,
} from './functions'
import type { RecurringAmountsView } from './recurring-amounts.server'

// jsdom's browser language is English, so the form is in English.
vi.mock('#/lib/client-log', () => ({ clientLog: { error: vi.fn() } }))
vi.mock('./functions', () => ({
  renameFinancingCharge: vi.fn(),
  setRecurringAmount: vi.fn(),
  undoRecurringAmount: vi.fn(),
}))
const save = vi.mocked(setRecurringAmount)
const rename = vi.mocked(renameFinancingCharge)
const undo = vi.mocked(undoRecurringAmount)

afterEach(() => {
  vi.clearAllMocks()
})

const view: RecurringAmountsView = {
  role: 'owner',
  today: '2026-11-21',
  ownershipStart: '2025-03-01',
  capitalised: 0,
  amounts: {
    rent: [],
    maintenance_charge: [
      { validFrom: '2025-03-01', validTo: '2025-12-31', value: 20500 },
      { validFrom: '2026-01-01', validTo: null, value: 21400 },
    ],
    financing_charge: [{ validFrom: '2025-03-01', validTo: null, value: 8600 }],
  },
  financingCharges: [
    {
      id: 'charge',
      name: null,
      periods: [{ validFrom: '2025-03-01', validTo: null, value: 8600 }],
    },
  ],
  treatments: [
    { validFrom: '2025-03-01', validTo: '2026-12-31', value: 'capitalised' },
    { validFrom: '2027-01-01', validTo: null, value: 'income_recognised' },
  ],
}

const charge = view.financingCharges[0]

function setup(
  what: 'rent' | 'maintenance_charge' | 'financing_charge',
  data = view,
) {
  const user = userEvent.setup()
  const onDone = vi.fn(() => Promise.resolve())
  render(
    <AmountForm
      propertyId="flat"
      what={what === 'financing_charge' ? charge : what}
      view={data}
      address="Kuusikuja 3 B 12"
      onDone={onDone}
      onClose={vi.fn()}
    />,
  )
  return { user, onDone }
}

async function enter(
  user: ReturnType<typeof userEvent.setup>,
  amount: string,
  from: string,
) {
  await user.type(screen.getByRole('textbox', { name: /amount/i }), amount)
  await user.type(screen.getByRole('textbox', { name: 'Valid from' }), from)
}

describe('Setting a rent or charge', () => {
  test('The change form shows the effect on the year', async () => {
    const { user } = setup('maintenance_charge')
    await enter(user, '226', '01/01/2027')
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('+€12.00/month (+5.6%)')
    expect(status).toHaveTextContent(
      'In 2027, deductible expenses go up by €144.00 over 12 months',
    )
  })

  test('the first amount has no current amount, difference or history', async () => {
    const { user } = setup('rent')
    expect(screen.getByRole('heading', { name: 'Set rent' })).toBeVisible()
    await enter(user, '890', '01/03/2025')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('list', { name: 'Change history' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible()
  })

  test('the history lists the periods, newest first', () => {
    setup('maintenance_charge')
    const rows = within(
      screen.getByRole('list', { name: 'Change history' }),
    ).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      'From 01/01/2026€214.00',
      'From 01/03/2025€205.00',
    ])
  })

  test('the financing charge effect follows the treatment on the start date', async () => {
    const { user } = setup('financing_charge')
    await enter(user, '90', '01/06/2026')
    expect(screen.getByRole('status')).toHaveTextContent(
      'In 2026, the acquisition cost goes up by €28.00 over 7 months',
    )
    await user.clear(screen.getByRole('textbox', { name: 'Valid from' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Valid from' }),
      '01/01/2027',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'In 2027, deductible expenses go up by €48.00 over 12 months',
    )
  })

  test('a rent change adds to rental income', async () => {
    const { user } = setup('rent', {
      ...view,
      amounts: {
        ...view.amounts,
        rent: [{ validFrom: '2025-03-01', validTo: null, value: 89000 }],
      },
    })
    await enter(user, '850', '01/12/2026')
    expect(screen.getByRole('status')).toHaveTextContent(
      'In 2026, rental income goes down by €40.00 over 1 month',
    )
  })

  test("a date that isn't the first of a month shows the reason", async () => {
    const { user } = setup('maintenance_charge')
    await enter(user, '226', '15/01/2027')
    await user.click(screen.getByRole('button', { name: 'Save change' }))
    expect(
      screen.getByText(/Amounts change from the start of a month/),
    ).toBeVisible()
    expect(save).not.toHaveBeenCalled()
  })

  test("the server's date reason is shown under the date", async () => {
    save.mockResolvedValue({ ok: false, reason: 'amount_date_too_early' })
    const { user, onDone } = setup('maintenance_charge')
    await enter(user, '226', '01/06/2025')
    await user.click(screen.getByRole('button', { name: 'Save change' }))
    expect(
      screen.getByText("The date can't be before the latest change."),
    ).toBeVisible()
    expect(onDone).not.toHaveBeenCalled()
  })

  test('saving sends the amount and date as typed', async () => {
    save.mockResolvedValue({ ok: true })
    const { user, onDone } = setup('maintenance_charge')
    await enter(user, '226', '01/01/2027')
    await user.click(screen.getByRole('button', { name: 'Save change' }))
    expect(save).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        kind: 'maintenance_charge',
        amount: '226',
        from: '01/01/2027',
      },
    })
    expect(onDone).toHaveBeenCalled()
  })
})

describe('Undoing the latest rent or charge change', () => {
  test('undoing asks first and names the amount that applies again', async () => {
    undo.mockResolvedValue({ ok: true })
    const { user, onDone } = setup('maintenance_charge')
    await user.click(
      screen.getByRole('button', { name: 'Undo the latest change' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Undo the amount from 01/01/2026?',
    })
    expect(dialog).toHaveTextContent(
      'The previous amount, €205.00 from 01/03/2025, applies again.',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Undo change' }),
    )
    expect(undo).toHaveBeenCalledWith({
      data: { propertyId: 'flat', kind: 'maintenance_charge' },
    })
    expect(onDone).toHaveBeenCalled()
  })

  test('the only period can be undone, and the dialog says it is removed', async () => {
    undo.mockResolvedValue({ ok: true })
    const { user, onDone } = setup('financing_charge')
    await user.click(
      screen.getByRole('button', { name: 'Undo the latest change' }),
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(
      'This charge has only this amount, so undoing it removes the charge.',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Undo change' }),
    )
    expect(undo).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        kind: 'financing_charge',
        chargeId: 'charge',
      },
    })
    expect(onDone).toHaveBeenCalled()
  })

  test('a refused undo is shown in the dialog', async () => {
    undo.mockResolvedValue({ ok: false, reason: 'amount_changed' })
    const { user, onDone } = setup('financing_charge')
    await user.click(
      screen.getByRole('button', { name: 'Undo the latest change' }),
    )
    const dialog = screen.getByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Undo change' }),
    )
    expect(within(dialog).getByText('The details have changed')).toBeVisible()
    expect(onDone).not.toHaveBeenCalled()
  })

  test('there is nothing to undo without a period', () => {
    setup('rent')
    expect(
      screen.queryByRole('button', { name: 'Undo the latest change' }),
    ).toBeNull()
  })
})

/** Renders the form of a named financing charge. */
function setupCharge(
  periods: { validFrom: string; validTo: string | null; value: number }[],
) {
  const user = userEvent.setup()
  const onDone = vi.fn(() => Promise.resolve())
  render(
    <AmountForm
      propertyId="flat"
      what={{ id: 'hissi', name: 'Hissiremontti', periods }}
      view={view}
      address="Kuusikuja 3 B 12"
      onDone={onDone}
      onClose={vi.fn()}
    />,
  )
  return { user, onDone }
}

describe('Renaming a financing charge', () => {
  test('the name is saved on its own', async () => {
    rename.mockResolvedValue({ ok: true })
    const { user, onDone } = setupCharge([
      { validFrom: '2025-03-01', validTo: null, value: 2400 },
    ])
    expect(screen.getByRole('heading', { name: 'Hissiremontti' })).toBeVisible()
    const name = screen.getByRole('textbox', { name: 'Name' })
    await user.clear(name)
    await user.type(name, 'Hissi ')
    await user.click(screen.getByRole('button', { name: 'Save name' }))
    expect(rename).toHaveBeenCalledWith({
      data: { propertyId: 'flat', chargeId: 'hissi', name: 'Hissi' },
    })
    expect(save).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalled()
  })

  test("the server's name reason is shown under the name", async () => {
    rename.mockResolvedValue({
      ok: false,
      reason: 'financing_charge_name_taken',
    })
    const { user, onDone } = setupCharge([
      { validFrom: '2025-03-01', validTo: null, value: 2400 },
    ])
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'x')
    await user.click(screen.getByRole('button', { name: 'Save name' }))
    expect(
      await screen.findByText(
        'The flat already has a financing charge with this name.',
      ),
    ).toBeVisible()
    expect(onDone).not.toHaveBeenCalled()
  })
})

describe('Ending a financing charge', () => {
  test('ending hides the amount and sends 0 from the date', async () => {
    save.mockResolvedValue({ ok: true })
    const { user } = setupCharge([
      { validFrom: '2025-03-01', validTo: null, value: 2400 },
    ])
    await user.click(screen.getByRole('button', { name: 'Ending' }))
    expect(screen.queryByRole('textbox', { name: /amount/i })).toBeNull()
    await user.type(
      screen.getByRole('textbox', { name: 'No longer collected from' }),
      '01/01/2027',
    )
    await user.click(
      screen.getByRole('button', { name: 'Mark the charge as ended' }),
    )
    expect(save).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        kind: 'financing_charge',
        chargeId: 'hissi',
        amount: '0',
        from: '01/01/2027',
      },
    })
  })

  test('an ended charge shows its name and history, and no amount', () => {
    setupCharge([
      { validFrom: '2025-03-01', validTo: '2025-12-31', value: 2400 },
      { validFrom: '2026-01-01', validTo: null, value: 0 },
    ])
    expect(
      screen.getByText(
        'This charge has ended. You can change its name or undo the latest change.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('textbox', { name: /amount/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Save/ })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Undo the latest change' }),
    ).toBeVisible()
  })
})
