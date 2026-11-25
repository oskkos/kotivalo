import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType, ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import type { DocumentRow } from './document.repository.server'
import type { DocumentsView } from './documents.server'
import { DocumentsPage } from './DocumentsPage'

// jsdom's browser language is English, so the page is in English. Links need
// a router; the linked component with the resolved path is enough.
vi.mock('@tanstack/react-router', () => ({
  createLink:
    (Component: ComponentType<{ href: string; children?: ReactNode }>) =>
    ({
      to,
      params,
      ...rest
    }: {
      to: string
      params?: Record<string, string>
      children?: ReactNode
    }) => (
      <Component
        {...rest}
        href={Object.entries(params ?? {}).reduce(
          (path, [key, value]) => path.replace(`$${key}`, value),
          to,
        )}
      />
    ),
}))

const property = {
  id: 'flat',
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2 as const,
  floorArea: 485,
}

const document = (
  id: string,
  kind: DocumentRow['kind'],
  name: string,
  date: string,
): DocumentRow => ({
  id,
  kind,
  name,
  date,
  contentType: 'application/pdf',
  size: 3_400_000,
})

const documents = [
  document('a', 'minutes', 'Yhtiökokous 2026', '2026-05-15'),
  document('b', 'financial_statement', 'Tilinpäätös 2025', '2026-04-28'),
  document('c', 'financial_statement', 'Tilinpäätös 2024', '2025-04-30'),
]

function setup(over: Partial<DocumentsView> = {}) {
  const view: DocumentsView = {
    role: 'owner',
    property,
    documents,
    usage: { bytes: 42 * 1024 * 1024, files: 3 },
    ...over,
  }
  render(<DocumentsPage view={view} onBack={vi.fn()} />)
  return userEvent.setup()
}

describe('The documents page', () => {
  test('Documents are grouped by kind, newest first', () => {
    setup()
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
    expect(headings).toEqual(['Financial statements', 'Minutes'])
    const statements = screen.getByRole('region', {
      name: 'Financial statements',
    })
    expect(
      within(statements)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      expect.stringContaining('Tilinpäätös 2025'),
      expect.stringContaining('Tilinpäätös 2024'),
    ])
    expect(statements).toHaveTextContent('Financial statement · 28/04/2026')
  })

  test('Filtering by kind', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Minutes' }))
    expect(screen.getByText('Yhtiökokous 2026')).toBeInTheDocument()
    expect(screen.queryByText('Tilinpäätös 2025')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByText('Tilinpäätös 2025')).toBeInTheDocument()
  })

  test('A flat without documents', () => {
    setup({ documents: [] })
    expect(screen.getByText('No documents yet')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Add document/ }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Show by kind' })).toBeNull()
  })

  test('An owner sees their storage use', () => {
    setup()
    expect(screen.getByText('Storage used 42 MB of 500 MB')).toBeInTheDocument()
  })

  test('A member sees the documents but can’t add', () => {
    setup({ role: 'member', usage: null })
    expect(screen.getByText('Tilinpäätös 2025')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Add document/ })).toBeNull()
    expect(screen.queryByText(/Storage used/)).toBeNull()
    expect(
      screen.getByText('Only owners add and delete documents.'),
    ).toBeInTheDocument()
  })
})
