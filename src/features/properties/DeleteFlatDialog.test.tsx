import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DeleteFlatDialog } from './DeleteFlatDialog'
import type { Property } from './property'

// jsdom's browser language is English.
const navigate = vi.fn()
const invalidate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ navigate, invalidate }),
}))

const functions = vi.hoisted(() => ({
  getPropertyDeletion: vi.fn(),
  deleteProperty: vi.fn(),
}))
vi.mock('./functions', () => functions)

const kuusikuja: Property = {
  id: 'flat',
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2,
  floorArea: 485,
}

const noData = {
  ok: true,
  allowed: true,
  hasData: false,
  counts: {
    tenancies: 0,
    rentPayments: 0,
    transactions: 0,
    receipts: 0,
    documents: 0,
  },
  members: [],
}

function renderDialog(onClose = vi.fn(), onArchive = vi.fn()) {
  render(
    <DeleteFlatDialog
      property={kuusikuja}
      open
      onClose={onClose}
      onArchive={onArchive}
    />,
  )
  return { onClose, onArchive }
}

beforeEach(() => {
  navigate.mockReset()
  invalidate.mockReset()
  functions.getPropertyDeletion.mockReset()
  functions.deleteProperty.mockReset()
  functions.deleteProperty.mockResolvedValue({ ok: true })
})

describe('Confirming the deletion of a flat', () => {
  test('An empty flat is deleted with a plain confirmation', async () => {
    functions.getPropertyDeletion.mockResolvedValue(noData)
    renderDialog()

    const dialog = screen.getByRole('dialog', { name: 'Delete the flat?' })
    const confirm = await within(dialog).findByRole('button', {
      name: 'Delete',
    })
    expect(dialog).toHaveTextContent(
      "Kuusikuja 3 B 12 will be deleted permanently. This can't be undone.",
    )
    expect(within(dialog).queryByRole('textbox')).toBeNull()

    fireEvent.click(confirm)

    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: '/',
        state: { notice: 'Kuusikuja 3 B 12 deleted' },
      })
    })
    // The list the router kept is reloaded, or it still shows the flat.
    await vi.waitFor(() => {
      expect(invalidate).toHaveBeenCalledOnce()
    })
    expect(functions.deleteProperty).toHaveBeenCalledWith({
      data: { id: 'flat' },
    })
  })

  test('The confirmation lists what is removed', async () => {
    functions.getPropertyDeletion.mockResolvedValue({
      ...noData,
      hasData: true,
      counts: {
        tenancies: 2,
        rentPayments: 26,
        transactions: 48,
        receipts: 31,
        documents: 5,
      },
      members: ['Jussi'],
    })
    renderDialog()

    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('2 tenancies')
    expect(dialog).toHaveTextContent('26 rent payments')
    expect(dialog).toHaveTextContent('48 entries')
    expect(dialog).toHaveTextContent('31 receipts')
    expect(dialog).toHaveTextContent('5 documents')
    expect(dialog).toHaveTextContent(
      'This member loses access to the flat: Jussi',
    )
    expect(dialog).toHaveTextContent('archive the flat instead')
  })

  test('Deleting waits for the street address', async () => {
    functions.getPropertyDeletion.mockResolvedValue({
      ...noData,
      hasData: true,
      counts: {
        tenancies: 0,
        rentPayments: 0,
        transactions: 3,
        receipts: 0,
        documents: 0,
      },
    })
    renderDialog()

    const button = await screen.findByRole('button', {
      name: 'Delete permanently',
    })
    const field = screen.getByRole('textbox', {
      name: 'Type the street address to confirm',
    })
    expect(button).toBeDisabled()

    fireEvent.change(field, { target: { value: 'Kuusikuja 3 B' } })
    expect(button).toBeDisabled()

    fireEvent.change(field, { target: { value: 'kuusikuja 3 b 12' } })
    expect(button).toBeEnabled()
  })

  test('Cancelling keeps the flat', async () => {
    functions.getPropertyDeletion.mockResolvedValue(noData)
    const { onClose } = renderDialog()

    await screen.findByRole('button', { name: 'Delete' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalled()
    expect(functions.deleteProperty).not.toHaveBeenCalled()
  })
})

describe('Deleting a flat', () => {
  test("A co-owned flat can't be deleted", async () => {
    functions.getPropertyDeletion.mockResolvedValue({
      ok: true,
      allowed: false,
      reason: 'property_delete_other_owners',
      otherOwners: ['Jussi'],
    })
    const { onArchive } = renderDialog()

    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText("The flat can't be deleted")
    expect(dialog).toHaveTextContent('Other owners: Jussi')
    expect(within(dialog).queryByRole('button', { name: /^Delete/ })).toBeNull()

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Archive flat' }),
    )
    expect(onArchive).toHaveBeenCalled()
  })

  test('a failed deletion is shown in the dialog', async () => {
    functions.getPropertyDeletion.mockResolvedValue(noData)
    functions.deleteProperty.mockResolvedValue({
      ok: false,
      reason: 'property_delete_other_owners',
    })
    renderDialog()

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(
      await screen.findByText("The flat can't be deleted"),
    ).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })
})
