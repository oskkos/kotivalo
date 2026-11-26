import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DepositReturnForm } from './DepositReturnForm'

// jsdom's browser language is English, so the form is in English.
const recordDepositReturn =
  vi.fn<(input: { data: unknown }) => Promise<unknown>>()
const updateDepositReturn =
  vi.fn<(input: { data: unknown }) => Promise<unknown>>()
const deleteDepositReturn =
  vi.fn<(input: { data: unknown }) => Promise<unknown>>()
vi.mock('./functions', () => ({
  recordDepositReturn: (input: { data: unknown }) => recordDepositReturn(input),
  updateDepositReturn: (input: { data: unknown }) => updateDepositReturn(input),
  deleteDepositReturn: (input: { data: unknown }) => deleteDepositReturn(input),
}))

function setup(over: Partial<Parameters<typeof DepositReturnForm>[0]> = {}) {
  const user = userEvent.setup()
  const onSaved = vi.fn(() => Promise.resolve())
  render(
    <DepositReturnForm
      propertyId="flat"
      tenancyId="t1"
      address="Kuusikuja 3 B 12"
      tenantName="Aino Koski"
      deposit={178000}
      lastRentDay="2026-12-31"
      today="2027-01-15"
      missing={[{ month: '2026-12', missing: 30000 }]}
      onSaved={onSaved}
      onClose={vi.fn()}
      {...over}
    />,
  )
  return { user, onSaved }
}

const box = (name: string) => screen.getByRole('textbox', { name })
const returned = () => within(screen.getByRole('status')).getByText(/€/)

beforeEach(() => {
  recordDepositReturn.mockReset()
  updateDepositReturn.mockReset()
  deleteDepositReturn.mockReset()
})

describe('Recording a deposit return', () => {
  test('Returning a deposit in full', async () => {
    recordDepositReturn.mockResolvedValue({ ok: true, returnId: 'r1' })
    const { user, onSaved } = setup()
    expect(returned()).toHaveTextContent('€1,780.00')
    expect(box('Return date')).toHaveValue('15/01/2027')
    expect(screen.queryByRole('textbox', { name: 'Unpaid rent €' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Save the return' }))
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled()
    })
    expect(recordDepositReturn).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        tenancyId: 't1',
        returnedOn: '15/01/2027',
        deductions: false,
        rentKept: '',
        damageKept: '',
        note: '',
      },
    })
  })

  test('Returning with deductions', async () => {
    recordDepositReturn.mockResolvedValue({ ok: true, returnId: 'r1' })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'With deductions' }))
    expect(screen.getByText('December 2026 · €300.00')).toBeVisible()
    await user.type(box('Unpaid rent €'), '300')
    await user.type(box('Damage and cleaning €'), '200')
    expect(returned()).toHaveTextContent('€1,280.00')
    await user.type(box('Note (optional)'), 'Lattian korjaus')
    await user.click(screen.getByRole('button', { name: 'Save the return' }))
    await waitFor(() => {
      expect(recordDepositReturn).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deductions: true,
          rentKept: '300',
          damageKept: '200',
          note: 'Lattian korjaus',
        }) as unknown,
      })
    })
  })

  test("the server's reasons show under the fields", async () => {
    recordDepositReturn.mockResolvedValue({
      ok: false,
      reason: 'deposit_rent_exceeds_unpaid',
    })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'With deductions' }))
    await user.type(box('Unpaid rent €'), '400')
    await user.click(screen.getByRole('button', { name: 'Save the return' }))
    expect(await screen.findByText(/more than the rent missing/)).toBeVisible()
  })

  test('a month with nothing missing says so', async () => {
    const { user } = setup({ missing: [] })
    await user.click(screen.getByRole('button', { name: 'With deductions' }))
    expect(
      screen.getByText('Every month of the tenancy is paid.'),
    ).toBeVisible()
  })

  test('a recorded return is corrected and deleted from the same page', async () => {
    updateDepositReturn.mockResolvedValue({ ok: true })
    deleteDepositReturn.mockResolvedValue({ ok: true })
    const { user, onSaved } = setup({
      editing: {
        id: 'r1',
        tenancyId: 't1',
        returnedOn: '2027-01-15',
        rentKept: 30000,
        damageKept: 20000,
        note: null,
      },
    })
    expect(box('Unpaid rent €')).toHaveValue('300.00')
    expect(box('Damage and cleaning €')).toHaveValue('200.00')
    await user.clear(box('Damage and cleaning €'))
    await user.type(box('Damage and cleaning €'), '150')
    expect(returned()).toHaveTextContent('€1,330.00')
    await user.click(screen.getByRole('button', { name: 'Save the return' }))
    await waitFor(() => {
      expect(updateDepositReturn).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: 'Delete the return' }))
    const dialog = screen.getByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete the return' }),
    )
    await waitFor(() => {
      expect(deleteDepositReturn).toHaveBeenCalledWith({
        data: { propertyId: 'flat', tenancyId: 't1' },
      })
    })
    expect(onSaved).toHaveBeenCalledTimes(2)
  })
})
