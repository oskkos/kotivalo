import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { DocumentDetails } from './document.repository.server'
import { DocumentForm } from './DocumentForm'

// jsdom's browser language is English, so the form is in English. jsdom has
// no image decoding, so the file is a PDF, which is sent as it is.
const addDocument = vi.hoisted(() => vi.fn())
const updateDocument = vi.hoisted(() => vi.fn())
vi.mock('./functions', () => ({ addDocument, updateDocument }))

const tenancies = [
  {
    id: 't1',
    tenantName: 'Aino Koski',
    validFrom: '2025-03-01',
    validTo: null,
  },
]

function setup(editing?: DocumentDetails) {
  const onSaved = vi.fn(() => Promise.resolve())
  render(
    <DocumentForm
      propertyId="flat"
      streetAddress="Kuusikuja 3 B 12"
      tenancies={tenancies}
      today="2026-11-25"
      editing={editing}
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
  )
  return { user: userEvent.setup(), onSaved }
}

const pdf = (name: string) =>
  new File([new Uint8Array(100)], name, { type: 'application/pdf' })

beforeEach(() => {
  addDocument.mockReset()
  updateDocument.mockReset()
})

describe('Adding a document', () => {
  test('The name is suggested from the file', async () => {
    const { user } = setup()
    await user.upload(
      screen.getByLabelText('Take a photo or choose a file'),
      pdf('Vastikkeet 2026.pdf'),
    )
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Vastikkeet 2026',
    )
    expect(screen.getByRole('button', { name: 'Other' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('textbox', { name: 'Document date' })).toHaveValue(
      '25/11/2026',
    )
  })

  test('a typed name is kept when another file is chosen', async () => {
    const { user } = setup()
    const input = screen.getByLabelText('Take a photo or choose a file')
    await user.upload(input, pdf('eka.pdf'))
    await user.clear(screen.getByRole('textbox', { name: 'Name' }))
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Oma nimi')
    await user.click(
      screen.getByRole('button', { name: 'Remove the chosen file' }),
    )
    await user.upload(
      screen.getByLabelText('Take a photo or choose a file'),
      pdf('toka.pdf'),
    )
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Oma nimi',
    )
  })

  test('A document needs a name', async () => {
    const { user } = setup()
    await user.upload(
      screen.getByLabelText('Take a photo or choose a file'),
      pdf('a.pdf'),
    )
    await user.clear(screen.getByRole('textbox', { name: 'Name' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('Give the document a name.'),
    ).toBeInTheDocument()
    expect(addDocument).not.toHaveBeenCalled()
  })

  test('the tenancy is asked only for a lease', async () => {
    const { user } = setup()
    expect(screen.queryByRole('group', { name: 'Tenancy' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Lease' }))
    const group = screen.getByRole('group', { name: 'Tenancy' })
    expect(group).toHaveTextContent('Aino Koski')
    expect(group).toHaveTextContent('No tenancy')
    expect(screen.getByRole('button', { name: /Aino Koski/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('saves the document as form data', async () => {
    addDocument.mockResolvedValue({ ok: true, documentId: 'd1' })
    const { user, onSaved } = setup()
    await user.upload(
      screen.getByLabelText('Take a photo or choose a file'),
      pdf('sopimus.pdf'),
    )
    await user.click(screen.getByRole('button', { name: 'Lease' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith('d1')
    })
    const [call] = addDocument.mock.calls as [{ data: FormData }][]
    const data = call[0].data
    expect(data.get('propertyId')).toBe('flat')
    expect(data.get('kind')).toBe('lease')
    expect(data.get('name')).toBe('sopimus')
    expect(data.get('tenancyId')).toBe('t1')
    expect((data.get('file') as File).name).toBe('sopimus.pdf')
  })

  test('the quota alert is shown', async () => {
    addDocument.mockResolvedValue({ ok: false, reason: 'storage_quota_full' })
    const { user } = setup()
    await user.upload(
      screen.getByLabelText('Take a photo or choose a file'),
      pdf('a.pdf'),
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Storage is full')).toBeInTheDocument()
  })

  test('a refused file shows its reason under the file', async () => {
    addDocument.mockResolvedValue({
      ok: false,
      reason: 'document_unsupported_type',
    })
    const { user } = setup()
    await user.upload(
      screen.getByLabelText('Take a photo or choose a file'),
      pdf('a.pdf'),
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/must be an image/)).toBeInTheDocument()
  })
})

describe('Editing a document', () => {
  const lease: DocumentDetails = {
    id: 'd1',
    propertyId: 'flat',
    kind: 'lease',
    name: 'Vuokrasopimus Aino',
    date: '2025-03-01',
    contentType: 'application/pdf',
    size: 1000,
    tenancyId: 't1',
    tenantName: 'Aino Koski',
    filename: 'a.pdf',
    uploadedBy: { id: 'annika', name: 'Annika' },
    createdAt: new Date(0),
  }

  test('has no file field, and saves the changes', async () => {
    updateDocument.mockResolvedValue({ ok: true })
    const { user, onSaved } = setup(lease)
    expect(screen.queryByLabelText('Take a photo or choose a file')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Other' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith('d1')
    })
    expect(updateDocument).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        documentId: 'd1',
        kind: 'other',
        name: 'Vuokrasopimus Aino',
        date: '01/03/2025',
        tenancyId: '',
      },
    })
  })
})
