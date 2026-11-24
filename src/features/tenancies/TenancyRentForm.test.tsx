import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { setTenancyRent } from './functions'
import type { Tenancy } from './tenancy.repository.server'
import { TenancyRentForm } from './TenancyRentForm'

// jsdom's browser language is English, so the form is in English.
vi.mock('#/lib/client-log', () => ({ clientLog: { error: vi.fn() } }))
vi.mock('./functions', () => ({ setTenancyRent: vi.fn() }))
vi.mock('#/features/recurring-amounts/functions', () => ({}))
const save = vi.mocked(setTenancyRent)

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

function setup() {
  const user = userEvent.setup()
  const onDone = vi.fn(() => Promise.resolve())
  render(
    <TenancyRentForm
      propertyId="flat"
      address="Kuusikuja 3 B 12"
      tenancy={aino}
      rents={[{ validFrom: '2025-03-01', validTo: null, value: 89000 }]}
      today="2026-11-22"
      onDone={onDone}
      onClose={vi.fn()}
    />,
  )
  return { user, onDone }
}

const box = (name: string) => screen.getByRole('textbox', { name })

beforeEach(() => {
  save.mockReset()
})

describe("Changing a tenancy's rent", () => {
  test('The form shows the difference', async () => {
    const { user } = setup()
    expect(screen.getByRole('heading', { name: 'Change rent' })).toBeVisible()
    await user.type(box('New amount (€/month)'), '920')
    await user.type(box('Valid from'), '01/03/2027')
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('+€30.00/month (+3.4%)')
    expect(status).toHaveTextContent(
      'In 2027, rental income goes up by €300.00 over 10 months',
    )
  })

  test('saves the rent and the date as typed', async () => {
    save.mockResolvedValue({ ok: true })
    const { user, onDone } = setup()
    await user.type(box('New amount (€/month)'), '920')
    await user.type(box('Valid from'), '01/03/2027')
    await user.click(screen.getByRole('button', { name: 'Save change' }))
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
    expect(save).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        tenancyId: 't1',
        amount: '920',
        from: '01/03/2027',
      },
    })
  })

  test("a server's date reason shows under the date", async () => {
    save.mockResolvedValue({ ok: false, reason: 'rent_date_after_tenancy' })
    const { user } = setup()
    await user.type(box('New amount (€/month)'), '920')
    await user.type(box('Valid from'), '01/02/2027')
    await user.click(screen.getByRole('button', { name: 'Save change' }))
    expect(
      await screen.findByText(
        "The date can't be after the tenancy's last day.",
      ),
    ).toBeVisible()
  })
})
