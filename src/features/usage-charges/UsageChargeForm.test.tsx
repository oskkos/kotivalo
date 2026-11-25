import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { UsageChargePeriods } from './months'
import { UsageChargeForm } from './UsageChargeForm'

// jsdom's browser language is English, so the form is in English.
const addUsageCharge = vi.fn<(input: { data: unknown }) => Promise<unknown>>()
const setUsageCharge = vi.fn<(input: { data: unknown }) => Promise<unknown>>()
const entriesSince = vi.fn<(input: { data: unknown }) => Promise<unknown>>()
vi.mock('./functions', () => ({
  addUsageCharge: (input: { data: unknown }) => addUsageCharge(input),
  setUsageCharge: (input: { data: unknown }) => setUsageCharge(input),
}))
vi.mock('#/features/transactions/functions', () => ({
  entriesSince: (input: { data: unknown }) => entriesSince(input),
}))

const water: UsageChargePeriods = {
  id: 'water',
  kind: 'water',
  basis: 'per_occupant',
  description: null,
  periods: [
    { validFrom: '2026-01-01', validTo: '2026-12-31', value: 2200 },
    { validFrom: '2027-01-01', validTo: null, value: 2400 },
  ],
}

function setup(charge?: UsageChargePeriods) {
  const user = userEvent.setup()
  const onDone = vi.fn(() => Promise.resolve())
  const onUndo = vi.fn()
  render(
    <UsageChargeForm
      propertyId="flat"
      address="Kuusikuja 3 B 12"
      persons={2}
      charge={charge}
      onDone={onDone}
      onClose={vi.fn()}
      onUndo={onUndo}
    />,
  )
  return { user, onDone, onUndo }
}

const box = (name: string) => screen.getByRole('textbox', { name })

beforeEach(() => {
  addUsageCharge.mockReset()
  setUsageCharge.mockReset()
  entriesSince.mockReset()
  entriesSince.mockResolvedValue({ ok: true, count: 0, total: 0 })
})

describe('Adding a usage charge', () => {
  test('Adding the water charge per occupant', async () => {
    addUsageCharge.mockResolvedValue({ ok: true, chargeId: 'c' })
    const { user, onDone } = setup()
    await user.type(box('Amount (€/occupant/month)'), '22')
    expect(screen.getByText('Today €44.00/month (2 occupants)')).toBeVisible()
    expect(
      screen.getByText(
        /In the year summary: Maintenance charges and water charges/,
      ),
    ).toBeVisible()
    await user.type(box('Valid from'), '01/01/2026')
    await user.click(screen.getByRole('button', { name: 'Add a usage charge' }))
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
    expect(addUsageCharge).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        kind: 'water',
        basis: 'per_occupant',
        description: '',
        amount: '22',
        from: '01/01/2026',
      },
    })
  })

  test('Other with a description', async () => {
    const { user } = setup()
    expect(screen.queryByRole('textbox', { name: 'Description' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Other' }))
    expect(box('Description')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Fixed' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText(/In the year summary: Other costs/)).toBeVisible()
  })
})

describe('Water charge entries are warned about', () => {
  test('Water charge entries after the start are warned about', async () => {
    entriesSince.mockResolvedValue({ ok: true, count: 10, total: 44000 })
    const { user } = setup()
    await user.type(box('Valid from'), '01/01/2026')
    expect(
      await screen.findByText(
        /Water charge entries from 01\/01\/2026: 10, €440\.00 in all\./,
      ),
    ).toBeVisible()
    expect(entriesSince).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        category: 'water_charge',
        from: '2026-01-01',
      },
    })
  })

  test('other kinds show no warning', async () => {
    entriesSince.mockResolvedValue({ ok: true, count: 10, total: 44000 })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Parking space' }))
    await user.type(box('Valid from'), '01/01/2026')
    expect(entriesSince).not.toHaveBeenCalled()
  })
})

describe('Changing a usage charge', () => {
  test('Ending a parking space', async () => {
    setUsageCharge.mockResolvedValue({ ok: true })
    const { user, onDone } = setup({
      ...water,
      kind: 'parking',
      basis: 'fixed',
    })
    await user.click(screen.getByRole('button', { name: 'Ending' }))
    await user.type(box('Valid from'), '01/03/2027')
    await user.click(screen.getByRole('button', { name: 'Save change' }))
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
    expect(setUsageCharge).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        chargeId: 'water',
        amount: '0',
        from: '01/03/2027',
      },
    })
  })

  test('the amounts newest first, and the undo', async () => {
    const { user, onUndo } = setup(water)
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual(['From 01/01/2027€24.00', 'From 01/01/2026€22.00'])
    await user.click(
      screen.getByRole('button', { name: 'Undo the latest change' }),
    )
    expect(onUndo).toHaveBeenCalled()
  })
})
