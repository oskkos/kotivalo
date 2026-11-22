import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Tenancy } from './tenancy.repository.server'
import { TenancyForm } from './TenancyForm'

// jsdom's browser language is English, so the form is in English.
const createTenancy = vi.fn<(input: { data: unknown }) => Promise<unknown>>()
const updateTenancy = vi.fn<(input: { data: unknown }) => Promise<unknown>>()
vi.mock('./functions', () => ({
  createTenancy: (input: { data: unknown }) => createTenancy(input),
  updateTenancy: (input: { data: unknown }) => updateTenancy(input),
}))

const aino: Tenancy = {
  id: 't1',
  propertyId: 'flat',
  tenantName: 'Aino Koski',
  tenantPhone: '040 123 4567',
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

function setup(editing?: Tenancy) {
  const user = userEvent.setup()
  const onSaved = vi.fn(() => Promise.resolve())
  render(
    <TenancyForm
      propertyId="flat"
      address="Kuusikuja 3 B 12"
      editing={editing}
      rents={[
        { validFrom: '2025-03-01', validTo: '2026-12-31', value: 89000 },
        { validFrom: '2027-01-01', validTo: null, value: 91000 },
      ]}
      onSaved={onSaved}
      onClose={vi.fn()}
    />,
  )
  return { user, onSaved }
}

const box = (name: string) => screen.getByRole('textbox', { name })

beforeEach(() => {
  createTenancy.mockReset()
  updateTenancy.mockReset()
})

describe('Adding a tenant', () => {
  test('Contract made defaults to the start date', async () => {
    const { user } = setup()
    await user.type(box('Starts'), '15/03/2027')
    expect(box('Contract made')).toHaveValue('15/03/2027')
  })
})

describe('The rent of a new tenancy', () => {
  test('The form shows the rent in effect on the start date', async () => {
    const { user } = setup()
    await user.type(box('Starts'), '01/12/2026')
    expect(box('Monthly rent (€)')).toHaveValue('890.00')
    await user.clear(box('Starts'))
    await user.type(box('Starts'), '01/01/2027')
    expect(box('Monthly rent (€)')).toHaveValue('910.00')
  })
})

describe('tenancy form', () => {
  test('saves a new tenant and sends the fields as typed', async () => {
    createTenancy.mockResolvedValue({ ok: true, tenancyId: 't2' })
    const { user, onSaved } = setup()
    await user.type(box('Name'), 'Mikko Lehtinen')
    await user.click(screen.getByRole('button', { name: 'Fixed-term' }))
    await user.type(box('Starts'), '01/01/2027')
    await user.type(box('Ends'), '31/12/2027')
    await user.type(box('Due day'), '5')
    await user.click(screen.getByRole('button', { name: 'Save tenant' }))
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled()
    })
    expect(createTenancy).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        tenantName: 'Mikko Lehtinen',
        tenantPhone: '',
        tenantEmail: '',
        contractType: 'fixed_term',
        contractMade: '01/01/2027',
        validFrom: '01/01/2027',
        termEnd: '31/12/2027',
        rent: '910.00',
        dueDay: '5',
      },
    })
  })

  test('the end date shows only for a fixed term', async () => {
    const { user } = setup()
    expect(screen.queryByRole('textbox', { name: 'Ends' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Fixed-term' }))
    expect(box('Ends')).toBeVisible()
  })

  test("a server's field reason shows under its field", async () => {
    createTenancy.mockResolvedValue({ ok: false, reason: 'tenancy_overlaps' })
    const { user } = setup()
    await user.type(box('Name'), 'Mikko Lehtinen')
    await user.type(box('Starts'), '01/12/2026')
    await user.type(box('Due day'), '5')
    await user.click(screen.getByRole('button', { name: 'Save tenant' }))
    expect(
      await screen.findByText(
        'The tenancy overlaps another tenancy. Check the start and end dates.',
      ),
    ).toBeVisible()
  })

  test('an empty name is refused before sending', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Save tenant' }))
    expect(await screen.findByText("Write the tenant's name.")).toBeVisible()
    expect(createTenancy).not.toHaveBeenCalled()
  })

  test('correcting starts from the tenancy and has no rent', async () => {
    updateTenancy.mockResolvedValue({ ok: true })
    const { user, onSaved } = setup(aino)
    expect(screen.getByRole('heading', { name: 'Edit tenancy' })).toBeVisible()
    expect(box('Name')).toHaveValue('Aino Koski')
    expect(box('Contract made')).toHaveValue('12/02/2025')
    expect(
      screen.queryByRole('textbox', { name: 'Monthly rent (€)' }),
    ).toBeNull()
    await user.clear(box('Phone'))
    await user.type(box('Phone'), '040 765 4321')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled()
    })
    expect(updateTenancy).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenancyId: 't1',
        tenantPhone: '040 765 4321',
        contractMade: '12/02/2025',
      }) as unknown,
    })
  })
})
