import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { CancelEndingDialog } from './CancelEndingDialog'
import { EndTenancyForm } from './EndTenancyForm'
import type { Tenancy } from './tenancy.repository.server'

// jsdom's browser language is English, so the form is in English.
const endTenancy = vi.fn<(input: { data: unknown }) => Promise<unknown>>()
const cancelTenancyEnding =
  vi.fn<(input: { data: unknown }) => Promise<unknown>>()
vi.mock('./functions', () => ({
  endTenancy: (input: { data: unknown }) => endTenancy(input),
  cancelTenancyEnding: (input: { data: unknown }) => cancelTenancyEnding(input),
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

const fixedTerm: Tenancy = {
  ...aino,
  tenantName: 'Mikko Lehtinen',
  contractType: 'fixed_term',
  contractMade: '2026-11-20',
  validFrom: '2027-01-01',
  validTo: '2027-12-31',
  termEnd: '2027-12-31',
}

function setup(tenancy: Tenancy, today = '2026-11-22') {
  const user = userEvent.setup()
  const onDone = vi.fn(() => Promise.resolve())
  render(
    <EndTenancyForm
      propertyId="flat"
      address="Kuusikuja 3 B 12"
      tenancy={tenancy}
      today={today}
      onDone={onDone}
      onClose={vi.fn()}
    />,
  )
  return { user, onDone }
}

const lastDay = () =>
  screen.getByRole('textbox', { name: 'Last day of the tenancy' })

beforeEach(() => {
  endTenancy.mockReset()
  cancelTenancyEnding.mockReset()
})

describe('end tenancy form', () => {
  test("the tenant's notice suggests the end of the next month", async () => {
    endTenancy.mockResolvedValue({ ok: true })
    const { user, onDone } = setup(aino)
    expect(screen.getByRole('button', { name: 'Tenant' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(lastDay()).toHaveValue('31/12/2026')
    expect(screen.getByRole('status')).toHaveTextContent(
      "By law, the tenant's notice period is 1 month from the end of the month notice was given: 31/12/2026.",
    )
    await user.click(screen.getByRole('button', { name: 'End tenancy' }))
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
    expect(endTenancy).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        tenancyId: 't1',
        noticeGivenBy: 'tenant',
        noticeDate: '22/11/2026',
        lastDay: '31/12/2026',
      },
    })
  })

  test("the landlord's notice follows the contract date", async () => {
    const { user } = setup(aino)
    await user.click(screen.getByRole('button', { name: 'Landlord' }))
    expect(lastDay()).toHaveValue('31/05/2027')
    expect(screen.getByRole('status')).toHaveTextContent(
      "The contract was made on 12/02/2025. Given how long the tenancy had lasted on the notice date, the landlord's notice period is 6 months: 31/05/2027 at the earliest.",
    )
  })

  test("the landlord's limit shows under the last day", async () => {
    endTenancy.mockResolvedValue({
      ok: false,
      reason: 'tenancy_end_before_notice_period',
    })
    const { user } = setup(aino)
    await user.click(screen.getByRole('button', { name: 'Landlord' }))
    await user.clear(lastDay())
    await user.type(lastDay(), '31/03/2027')
    await user.click(screen.getByRole('button', { name: 'End tenancy' }))
    expect(
      await screen.findByText(
        "The landlord's notice period ends later. Choose a later day, or choose By agreement if you and the tenant have agreed on the ending.",
      ),
    ).toBeVisible()
  })

  test('payments after the last day show as an alert', async () => {
    endTenancy.mockResolvedValue({
      ok: false,
      reason: 'tenancy_has_payments_outside',
    })
    const { user } = setup(aino)
    await user.click(screen.getByRole('button', { name: 'End tenancy' }))
    expect(
      await screen.findByText('Payments would fall outside the tenancy'),
    ).toBeVisible()
  })

  test('an edited last day stays when the way changes', async () => {
    const { user } = setup(aino)
    await user.clear(lastDay())
    await user.type(lastDay(), '15/12/2026')
    await user.click(screen.getByRole('button', { name: 'By agreement' }))
    expect(lastDay()).toHaveValue('15/12/2026')
  })

  test('a fixed term offers agreement, a court or another ground', () => {
    setup(fixedTerm, '2027-05-20')
    expect(
      screen.getByText(
        "The fixed-term contract ends by itself on 31/12/2027 and usually can't be ended by notice. It can end earlier by agreement, with a court's permission or on another ground, such as rescission.",
      ),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Tenant' })).toBeNull()
    expect(
      screen.getByRole('button', { name: "Court's permission" }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Other ground' })).toBeVisible()
    expect(
      screen.getByRole('textbox', { name: 'Date agreed or decided' }),
    ).toHaveValue('20/05/2027')
  })
})

describe('cancel ending dialog', () => {
  test('confirming cancels the ending', async () => {
    cancelTenancyEnding.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    const onDone = vi.fn(() => Promise.resolve())
    render(
      <CancelEndingDialog
        propertyId="flat"
        tenancy={{
          ...aino,
          validTo: '2026-12-31',
          noticeGivenBy: 'tenant',
          noticeDate: '2026-11-22',
        }}
        open
        onClose={vi.fn()}
        onDone={onDone}
      />,
    )
    expect(
      screen.getByText(
        'Aino Koski stays on as the tenant, and the tenancy is open-ended again.',
      ),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cancel the ending' }))
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
    expect(cancelTenancyEnding).toHaveBeenCalledWith({
      data: { propertyId: 'flat', tenancyId: 't1' },
    })
  })

  test('a refusal shows as an alert', async () => {
    cancelTenancyEnding.mockResolvedValue({
      ok: false,
      reason: 'tenancy_cancel_later_tenancy',
    })
    const user = userEvent.setup()
    render(
      <CancelEndingDialog
        propertyId="flat"
        tenancy={{
          ...fixedTerm,
          noticeGivenBy: 'agreed',
          noticeDate: '2027-05-15',
        }}
        open
        onClose={vi.fn()}
        onDone={vi.fn(() => Promise.resolve())}
      />,
    )
    expect(
      screen.getByText(
        'Mikko Lehtinen stays on as the tenant, and the tenancy ends again when the fixed term ends on 31/12/2027.',
      ),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cancel the ending' }))
    expect(
      await screen.findByText("The ending can't be cancelled"),
    ).toBeVisible()
  })
})
