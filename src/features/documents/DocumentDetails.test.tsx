import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { DocumentDetails as Details } from './document.repository.server'
import { DocumentDetails } from './DocumentDetails'

// jsdom's browser language is English, so the page is in English. The page
// imports an icon from the documents page, which uses router links.
vi.mock('@tanstack/react-router', () => ({ createLink: () => () => null }))
const deleteDocument = vi.hoisted(() => vi.fn())
vi.mock('./functions', () => ({ deleteDocument }))

const property = {
  id: 'flat',
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2 as const,
  floorArea: 485,
}

const statement: Details = {
  id: 'd1',
  propertyId: 'flat',
  kind: 'financial_statement',
  name: 'Tilinpäätös 2025',
  date: '2026-04-28',
  contentType: 'application/pdf',
  size: 3_400_000,
  tenancyId: null,
  tenantName: null,
  filename: 'tilinpaatos_2025.pdf',
  uploadedBy: { id: 'annika', name: 'Annika' },
  createdAt: new Date(Date.UTC(2026, 4, 2, 10)),
}

function setup(
  over: Partial<Details> = {},
  role: 'owner' | 'member' = 'owner',
) {
  const onDeleted = vi.fn(() => Promise.resolve())
  render(
    <DocumentDetails
      document={{ ...statement, ...over }}
      property={property}
      role={role}
      addedByYou={false}
      onBack={vi.fn()}
      editAction={<button type="button">Edit</button>}
      onDeleted={onDeleted}
    />,
  )
  return { user: userEvent.setup(), onDeleted }
}

beforeEach(() => {
  deleteDocument.mockReset()
})

describe('Document details', () => {
  test('An owner opens a document', () => {
    setup()
    expect(
      screen.getByRole('heading', { name: 'Tilinpäätös 2025' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Financial statement')).toBeInTheDocument()
    expect(screen.getByText('28/04/2026')).toBeInTheDocument()
    expect(screen.getByText(/tilinpaatos_2025\.pdf/)).toBeInTheDocument()
    expect(
      screen.getByText('Added by Annika on 02/05/2026'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      '/api/documents/d1?download=1',
    )
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete document' }),
    ).toBeInTheDocument()
  })

  test('A member opens a document', () => {
    setup({}, 'member')
    expect(screen.getByRole('link', { name: 'Download' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete document' })).toBeNull()
  })

  test('a lease shows its tenancy', () => {
    setup({ kind: 'lease', tenancyId: 't1', tenantName: 'Aino Koski' })
    expect(screen.getByText('Tenancy: Aino Koski')).toBeInTheDocument()
  })

  test('an image opens full screen', async () => {
    const { user } = setup({ contentType: 'image/jpeg', filename: 'a.jpg' })
    await user.click(
      screen.getByRole('button', { name: /Image of the document/ }),
    )
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  test('the delete dialog names the document and deletes it', async () => {
    deleteDocument.mockResolvedValue({ ok: true })
    const { user, onDeleted } = setup()
    await user.click(screen.getByRole('button', { name: 'Delete document' }))
    expect(
      screen.getByText(/Tilinpäätös 2025 is deleted for everyone/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalled()
    })
    expect(deleteDocument).toHaveBeenCalledWith({
      data: { propertyId: 'flat', documentId: 'd1' },
    })
  })

  test('Cancelling keeps the document', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Delete document' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(deleteDocument).not.toHaveBeenCalled()
  })

  test('a refused deletion shows the reason', async () => {
    deleteDocument.mockResolvedValue({
      ok: false,
      reason: 'document_not_found',
    })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Delete document' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Document not found')).toBeInTheDocument()
  })
})
