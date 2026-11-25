import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { EMPTY_PROPERTY, PropertyForm, type SaveResult } from './PropertyForm'
import type { NewPropertyInput } from './schemas'

// jsdom's browser language is English, so the form is in English.
vi.mock('#/lib/client-log', () => ({ clientLog: { error: vi.fn() } }))

function setup(
  options: {
    initial?: NewPropertyInput
    save?: (details: NewPropertyInput) => Promise<SaveResult>
  } = {},
) {
  const save = vi.fn(
    options.save ?? (() => Promise.resolve<SaveResult>({ ok: true })),
  )
  const onSaved = vi.fn()
  const onClose = vi.fn()
  render(
    <PropertyForm
      title="New flat"
      initial={options.initial ?? EMPTY_PROPERTY}
      save={save}
      onSaved={onSaved}
      onClose={onClose}
    />,
  )
  return { user: userEvent.setup(), save, onSaved, onClose }
}

const field = (name: string) => screen.getByRole('textbox', { name })
const saveButton = () => screen.getByRole('button', { name: 'Save flat' })

async function fillIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(field('Street address'), 'Kuusikuja 3 B 12')
  await user.type(field('Postcode'), '33100')
  await user.type(field('City'), 'Tampere')
  await user.click(screen.getByRole('button', { name: '2 rooms' }))
  await user.type(field('Floor area (m²)'), '48,5')
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('PropertyForm', () => {
  test('saves the details as typed', async () => {
    const { user, save, onSaved } = setup()
    await fillIn(user)
    await user.click(saveButton())

    expect(save).toHaveBeenCalledWith({
      streetAddress: 'Kuusikuja 3 B 12',
      postcode: '33100',
      city: 'Tampere',
      roomCount: 2,
      floorArea: '48,5',
      housingCompanyName: '',
      businessId: '',
      apartmentNumber: '',
    })
    expect(onSaved).toHaveBeenCalledOnce()
  })

  test('shows every missing detail under its field and saves nothing', async () => {
    const { user, save } = setup()
    await user.click(saveButton())

    expect(field('Street address')).toHaveAccessibleDescription(
      'Enter the street address.',
    )
    expect(field('Postcode')).toHaveAccessibleDescription(
      'A postcode has 5 digits.',
    )
    expect(field('City')).toHaveAccessibleDescription('Enter the city.')
    expect(
      screen.getByRole('group', { name: 'Rooms' }),
    ).toHaveAccessibleDescription('Choose the number of rooms.')
    expect(field('Floor area (m²)')).toHaveAccessibleDescription(
      'Enter the floor area in square metres, for example 48.5.',
    )
    expect(save).not.toHaveBeenCalled()
  })

  test('opens with the given details', () => {
    setup({
      initial: {
        streetAddress: 'Kuusikuja 3 B 12',
        postcode: '33100',
        city: 'Tampere',
        roomCount: 2,
        floorArea: '48,5',
      },
    })

    expect(field('Street address')).toHaveValue('Kuusikuja 3 B 12')
    expect(field('Floor area (m²)')).toHaveValue('48,5')
    expect(screen.getByRole('button', { name: '2 rooms' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('shows a refusal from the server as an alert', async () => {
    const { user, onSaved } = setup({
      save: () =>
        Promise.resolve({ ok: false, reason: 'property_limit_reached' }),
    })
    await fillIn(user)
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You already have 100 flats',
    )
    expect(onSaved).not.toHaveBeenCalled()
  })

  test('shows an unexpected failure with a reference', async () => {
    const { user } = setup({ save: () => Promise.reject(new Error('down')) })
    await fillIn(user)
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong',
    )
  })

  test('says there is no connection when the request never got through', async () => {
    const { user } = setup({
      save: () => Promise.reject(new TypeError('Failed to fetch')),
    })
    await fillIn(user)
    await user.click(saveButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No connection')
    expect(alert).not.toHaveTextContent('Error reference')
  })

  test('closes without saving', async () => {
    const { user, save, onClose } = setup()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(save).not.toHaveBeenCalled()
  })
})

describe('The Ownership section', () => {
  test('a new flat asks since when it has been owned, and sends it', async () => {
    const { user, save } = setup({
      initial: { ...EMPTY_PROPERTY, ownedSince: '20/11/2026' },
    })
    await fillIn(user)
    await user.clear(field('Owned since'))
    await user.type(field('Owned since'), '12/06/2022')
    await user.click(saveButton())

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ ownedSince: '12/06/2022' }),
    )
  })

  test('an invalid date is shown under the field and nothing is saved', async () => {
    const { user, save } = setup({
      initial: { ...EMPTY_PROPERTY, ownedSince: '31/02/2026' },
    })
    await fillIn(user)
    await user.click(saveButton())

    expect(
      await screen.findByText(
        'Enter the date as dd/mm/yyyy, for example 12/06/2022.',
      ),
    ).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })

  test('the edit form has no ownership section', () => {
    setup()
    expect(
      screen.queryByRole('textbox', { name: 'Owned since' }),
    ).not.toBeInTheDocument()
  })
})

describe('Housing company details of a flat', () => {
  test('the housing company section asks for the three details and sends them', async () => {
    const { user, save } = setup()
    await fillIn(user)
    expect(
      screen.getByRole('heading', { name: 'Housing company' }),
    ).toBeInTheDocument()
    await user.type(field('Housing company name'), 'As Oy Kuusikuja 3')
    await user.type(field('Business ID'), '2345678-0')
    await user.type(field('Apartment number'), 'B 12')
    await user.click(saveButton())

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        housingCompanyName: 'As Oy Kuusikuja 3',
        businessId: '2345678-0',
        apartmentNumber: 'B 12',
      }),
    )
  })

  test('the details may be left empty', async () => {
    const { user, save } = setup()
    await fillIn(user)
    await user.click(saveButton())

    expect(save).toHaveBeenCalledOnce()
  })

  test('A Business ID with a wrong check digit is not saved', async () => {
    const { user, save } = setup()
    await fillIn(user)
    await user.type(field('Business ID'), '2345678-9')
    await user.click(saveButton())

    expect(field('Business ID')).toHaveAccessibleDescription(
      'A Business ID looks like 1234567-1 (seven digits, a hyphen and a check digit).',
    )
    expect(save).not.toHaveBeenCalled()
  })

  test('opens with the current housing company details', () => {
    setup({
      initial: {
        ...EMPTY_PROPERTY,
        housingCompanyName: 'As Oy Kuusikuja 3',
        businessId: '2345678-0',
        apartmentNumber: 'B 12',
      },
    })

    expect(field('Housing company name')).toHaveValue('As Oy Kuusikuja 3')
    expect(field('Business ID')).toHaveValue('2345678-0')
    expect(field('Apartment number')).toHaveValue('B 12')
  })
})
