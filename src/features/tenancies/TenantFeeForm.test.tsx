import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { FeeOfTenancy } from './fees'
import type { Tenancy } from './tenancy.repository.server'
import { TenantFeeForm } from './TenantFeeForm'

// jsdom's browser language is English, so the form is in English.
const addTenantFee = vi.fn<(input: { data: unknown }) => Promise<unknown>>()
const setTenantFee = vi.fn<(input: { data: unknown }) => Promise<unknown>>()
const entriesSince = vi.fn<(input: { data: unknown }) => Promise<unknown>>()
vi.mock('./functions', () => ({
  addTenantFee: (input: { data: unknown }) => addTenantFee(input),
  setTenantFee: (input: { data: unknown }) => setTenantFee(input),
}))
vi.mock('#/features/transactions/functions', () => ({
  entriesSince: (input: { data: unknown }) => entriesSince(input),
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

const rents = [{ validFrom: '2025-03-01', validTo: null, value: 89000 }]
const occupants = [{ validFrom: '2025-03-01', validTo: null, value: 1 }]

const parking: FeeOfTenancy = {
  id: 'f2',
  kind: 'parking',
  basis: 'fixed',
  description: null,
  amounts: [
    { validFrom: '2026-02-01', validTo: '2026-12-31', value: 1500 },
    { validFrom: '2027-01-01', validTo: null, value: 2000 },
  ],
}

function setup(fee?: FeeOfTenancy) {
  const user = userEvent.setup()
  const onDone = vi.fn(() => Promise.resolve())
  const onUndo = vi.fn()
  render(
    <TenantFeeForm
      propertyId="flat"
      address="Kuusikuja 3 B 12"
      tenancy={aino}
      rents={rents}
      occupants={occupants}
      fees={fee ? [fee] : []}
      fee={fee}
      onDone={onDone}
      onClose={vi.fn()}
      onUndo={onUndo}
    />,
  )
  return { user, onDone, onUndo }
}

const box = (name: string) => screen.getByRole('textbox', { name })

beforeEach(() => {
  addTenantFee.mockReset()
  setTenantFee.mockReset()
  entriesSince.mockReset()
  entriesSince.mockResolvedValue({ ok: true, count: 0, total: 0 })
})

describe('Adding a tenant fee', () => {
  test('Adding a parking fee', async () => {
    addTenantFee.mockResolvedValue({ ok: true, feeId: 'f' })
    const { user, onDone } = setup()
    await user.click(screen.getByRole('button', { name: 'Parking space' }))
    await user.type(box('Amount (€/month)'), '15')
    await user.type(box('Valid from'), '01/12/2026')
    expect(
      screen.getByText(
        'From 01/12/2026 the tenant pays €905.00/month in total.',
      ),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Add fee' }))
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
    expect(addTenantFee).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        tenancyId: 't1',
        kind: 'parking',
        basis: 'fixed',
        description: '',
        amount: '15',
        from: '01/12/2026',
      },
    })
  })

  test('the basis follows the kind until chosen', async () => {
    const { user } = setup()
    expect(
      screen.getByRole('button', { name: 'Per occupant' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Sauna' }))
    expect(screen.getByRole('button', { name: 'Fixed' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: 'Per occupant' }))
    await user.click(screen.getByRole('button', { name: 'Water charge' }))
    await user.click(screen.getByRole('button', { name: 'Fixed' }))
    await user.click(screen.getByRole('button', { name: 'Parking space' }))
    expect(screen.getByRole('button', { name: 'Fixed' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('Other fee with a description', async () => {
    const { user } = setup()
    expect(screen.queryByRole('textbox', { name: 'Description' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Other' }))
    expect(box('Description')).toBeVisible()
  })

  test('Tenant water charge entries are warned about', async () => {
    entriesSince.mockResolvedValue({ ok: true, count: 3, total: 13200 })
    const { user } = setup()
    await user.type(box('Valid from'), '01/01/2026')
    expect(
      await screen.findByText(
        /Tenant water charge entries from 01\/01\/2026: 3, €132\.00 in all\./,
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Open the entries' }),
    ).toHaveAttribute('href', '/properties/flat/transactions')
    expect(entriesSince).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        category: 'tenant_water_charge',
        from: '2026-01-01',
      },
    })
  })

  test("a server's reason shows under its field", async () => {
    addTenantFee.mockResolvedValue({
      ok: false,
      reason: 'rent_date_before_tenancy',
    })
    const { user } = setup()
    await user.type(box('Amount (€/occupant/month)'), '22')
    await user.type(box('Valid from'), '01/01/2025')
    await user.click(screen.getByRole('button', { name: 'Add fee' }))
    expect(await screen.findByText(/before the tenancy/i)).toBeVisible()
  })
})

describe('Changing a tenant fee', () => {
  test('The tenant gives up the parking space', async () => {
    setTenantFee.mockResolvedValue({ ok: true })
    const { user, onDone } = setup(parking)
    await user.click(screen.getByRole('button', { name: 'Ending' }))
    expect(screen.queryByRole('textbox', { name: /Amount/ })).toBeNull()
    await user.type(box('Valid from'), '01/03/2027')
    await user.click(screen.getByRole('button', { name: 'Save change' }))
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
    expect(setTenantFee).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        tenancyId: 't1',
        feeId: 'f2',
        amount: '0',
        from: '01/03/2027',
      },
    })
  })

  test("the fee's amounts show newest first with the undo", async () => {
    const { user, onUndo } = setup(parking)
    const items = screen.getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'From 01/01/2027€20.00',
      'From 01/02/2026€15.00',
    ])
    await user.click(
      screen.getByRole('button', { name: 'Undo the latest change' }),
    )
    expect(onUndo).toHaveBeenCalled()
  })
})
