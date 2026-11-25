import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Period } from '#/features/recurring-amounts/periods'
import type { FeeOfTenancy } from './fees'
import type { Tenancy } from './tenancy.repository.server'
import { previousTenancy, TenancyForm } from './TenancyForm'

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

const ainoRents = {
  t1: [
    { validFrom: '2025-03-01', validTo: '2026-02-28', value: 85000 },
    { validFrom: '2026-03-01', validTo: null, value: 89000 },
  ],
}

function setup(
  editing?: Tenancy,
  tenancies: Tenancy[] = [],
  tenancyRents: Record<string, Period<number>[]> = {},
  tenancyFees: Record<string, FeeOfTenancy[]> = {},
) {
  const user = userEvent.setup()
  const onSaved = vi.fn(() => Promise.resolve())
  render(
    <TenancyForm
      propertyId="flat"
      address="Kuusikuja 3 B 12"
      editing={editing}
      tenancies={tenancies}
      tenancyRents={tenancyRents}
      tenancyFees={tenancyFees}
      today="2026-11-22"
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
  const ending: Tenancy = {
    ...aino,
    validTo: '2026-12-31',
    noticeGivenBy: 'tenant',
    noticeDate: '2026-11-22',
  }

  test("The form suggests the previous tenancy's rent", async () => {
    const { user } = setup(undefined, [ending], ainoRents)
    expect(box('Monthly rent (€)')).toHaveValue('890.00')
    await user.type(box('Starts'), '01/01/2027')
    expect(box('Monthly rent (€)')).toHaveValue('890.00')
  })

  test("The first tenancy's rent field is empty", () => {
    setup()
    expect(box('Monthly rent (€)')).toHaveValue('')
  })

  test('The rent is required', async () => {
    const { user } = setup()
    await user.type(box('Name'), 'Mikko Lehtinen')
    await user.type(box('Starts'), '01/01/2027')
    await user.type(box('Due day'), '5')
    await user.click(screen.getByRole('button', { name: 'Save tenant' }))
    expect(
      await screen.findByText(
        'Enter the amount in euros, for example 214 or 214.50.',
      ),
    ).toBeVisible()
    expect(createTenancy).not.toHaveBeenCalled()
  })

  test('an earlier start suggests the tenancy before it', async () => {
    const pekka: Tenancy = {
      ...aino,
      id: 't0',
      tenantName: 'Pekka Virtanen',
      validFrom: '2023-06-01',
      validTo: '2025-02-28',
    }
    const { user } = setup(undefined, [ending, pekka], {
      ...ainoRents,
      t0: [{ validFrom: '2023-06-01', validTo: null, value: 82000 }],
    })
    await user.type(box('Starts'), '01/03/2024')
    expect(box('Monthly rent (€)')).toHaveValue('820.00')
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
    await user.type(box('Monthly rent (€)'), '910')
    await user.clear(box('Occupants'))
    await user.type(box('Occupants'), '2')
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
        rent: '910',
        occupants: '2',
        copyFeeIds: [],
        dueDay: '5',
      },
    })
  })

  test('the occupants default to one and show only when adding', () => {
    setup()
    expect(box('Occupants')).toHaveValue('1')
  })

  test("the server's reason for the occupants shows under the field", async () => {
    createTenancy.mockResolvedValue({ ok: false, reason: 'occupants_invalid' })
    const { user } = setup()
    await user.type(box('Name'), 'Mikko Lehtinen')
    await user.type(box('Starts'), '01/12/2026')
    await user.type(box('Monthly rent (€)'), '890')
    await user.type(box('Due day'), '5')
    await user.click(screen.getByRole('button', { name: 'Save tenant' }))
    expect(
      await screen.findByText(
        'Enter the number of occupants as a whole number from 1 to 20.',
      ),
    ).toBeVisible()
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
    await user.type(box('Monthly rent (€)'), '890')
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

describe('the previous tenancy in the new tenant form', () => {
  const ending = {
    ...aino,
    validTo: '2026-12-31',
    noticeGivenBy: 'tenant' as const,
  }
  const mikko: Tenancy = {
    ...aino,
    id: 't2',
    tenantName: 'Mikko Lehtinen',
    contractType: 'fixed_term',
    validFrom: '2027-01-01',
    termEnd: '2027-06-30',
    validTo: '2027-06-30',
  }
  // Newest first, as the page loads them.
  const flat = [mikko, ending]
  const today = '2026-11-22'

  test('is the latest tenancy ending before the start entered', () => {
    expect(previousTenancy(flat, '2027-07-01', today)?.tenantName).toBe(
      'Mikko Lehtinen',
    )
    expect(previousTenancy(flat, '2027-01-01', today)?.tenantName).toBe(
      'Aino Koski',
    )
  })

  test('is the latest tenancy before a start is entered', () => {
    expect(previousTenancy(flat, undefined, today)?.tenantName).toBe(
      'Mikko Lehtinen',
    )
  })

  test('is none once it has ended, or for an earlier tenancy', () => {
    expect(previousTenancy(flat, '2027-07-01', '2027-07-01')).toBeUndefined()
    expect(previousTenancy(flat, '2024-01-01', today)).toBeUndefined()
    expect(previousTenancy([aino], undefined, today)).toBeUndefined()
  })
})

describe('an earlier tenancy in the new tenant form', () => {
  test('records the ending with the suggested last day', async () => {
    createTenancy.mockResolvedValue({ ok: true, tenancyId: 't3' })
    const { user, onSaved } = setup(undefined, [])
    expect(
      screen.queryByRole('checkbox', { name: /Notice has already been given/ }),
    ).toBeNull()
    await user.type(box('Name'), 'Pekka Virtanen')
    await user.type(box('Starts'), '01/06/2023')
    await user.type(box('Monthly rent (€)'), '850')
    await user.type(box('Due day'), '5')
    await user.click(
      screen.getByRole('checkbox', { name: /Notice has already been given/ }),
    )
    await user.type(box('Notice date'), '20/01/2025')
    // The tenant's notice: the last day of the following month.
    expect(box('Last day of the tenancy')).toHaveValue('28/02/2025')
    await user.click(screen.getByRole('button', { name: 'Save tenant' }))
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled()
    })
    expect(createTenancy).toHaveBeenCalledWith({
      data: expect.objectContaining({
        validFrom: '01/06/2023',
        ending: {
          noticeGivenBy: 'tenant',
          noticeDate: '20/01/2025',
          lastDay: '28/02/2025',
        },
      }) as unknown,
    })
  })

  test("shows the server's reason under the last day", async () => {
    createTenancy.mockResolvedValue({
      ok: false,
      reason: 'tenancy_end_before_notice_period',
    })
    const { user } = setup(undefined, [])
    await user.type(box('Name'), 'Pekka Virtanen')
    await user.type(box('Starts'), '01/06/2023')
    await user.type(box('Monthly rent (€)'), '850')
    await user.type(box('Due day'), '5')
    await user.click(
      screen.getByRole('checkbox', { name: /Notice has already been given/ }),
    )
    await user.click(screen.getByRole('button', { name: 'Landlord' }))
    await user.type(box('Notice date'), '10/01/2025')
    await user.clear(box('Last day of the tenancy'))
    await user.type(box('Last day of the tenancy'), '28/02/2025')
    await user.click(screen.getByRole('button', { name: 'Save tenant' }))
    expect(
      await screen.findByText(/landlord's notice period ends later/i),
    ).toBeInTheDocument()
  })
})

describe('Occupants and fees of a new tenancy', () => {
  const ending: Tenancy = {
    ...aino,
    validTo: '2026-12-31',
    noticeGivenBy: 'tenant',
    noticeDate: '2026-11-22',
  }
  const fees: Record<string, FeeOfTenancy[]> = {
    t1: [
      {
        id: 'water',
        kind: 'water',
        basis: 'per_occupant',
        description: null,
        amounts: [{ validFrom: '2025-03-01', validTo: null, value: 2200 }],
      },
      {
        id: 'parking',
        kind: 'parking',
        basis: 'fixed',
        description: null,
        amounts: [{ validFrom: '2025-03-01', validTo: null, value: 1500 }],
      },
    ],
  }

  test("The previous tenancy's fees are offered unchecked", async () => {
    const { user } = setup(undefined, [ending], ainoRents, fees)
    await user.type(box('Starts'), '01/01/2027')
    const water = screen.getByRole('checkbox', {
      name: 'Water charge · €22.00/occupant',
    })
    const parking = screen.getByRole('checkbox', {
      name: 'Parking space · €15.00',
    })
    expect(water).not.toBeChecked()
    expect(parking).not.toBeChecked()
  })

  test('A checked fee is copied to the new tenancy', async () => {
    createTenancy.mockResolvedValue({ ok: true, tenancyId: 't2' })
    const { user, onSaved } = setup(undefined, [ending], ainoRents, fees)
    await user.type(box('Name'), 'Mikko Lehtinen')
    await user.type(box('Starts'), '01/01/2027')
    await user.clear(box('Monthly rent (€)'))
    await user.type(box('Monthly rent (€)'), '890')
    await user.type(box('Due day'), '5')
    await user.click(
      screen.getByRole('checkbox', { name: 'Water charge · €22.00/occupant' }),
    )
    expect(screen.getByRole('status')).toHaveTextContent('€912.00')
    await user.click(screen.getByRole('button', { name: 'Save tenant' }))
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled()
    })
    expect(createTenancy.mock.calls[0]?.[0].data).toMatchObject({
      copyFeeIds: ['water'],
      occupants: '1',
    })
  })

  test('No fees are offered for the first tenancy', () => {
    setup()
    expect(box('Occupants')).toHaveValue('1')
    expect(screen.queryByRole('checkbox', { name: /€/ })).toBeNull()
  })
})
