import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import type { Property } from './property'
import { PropertyList } from './PropertyList'

// Links need a router; an anchor with the resolved path is enough here.
vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    to: string
    params?: Record<string, string>
    children?: ReactNode
    'aria-label'?: string
    className?: string
  }) => {
    const href = Object.entries(props.params ?? {}).reduce(
      (path, [key, value]) => path.replace(`$${key}`, value),
      props.to,
    )
    return (
      <a
        href={href}
        aria-label={props['aria-label']}
        className={props.className}
      >
        {props.children}
      </a>
    )
  },
}))

const flat = (id: string, streetAddress: string): Property => ({
  id,
  streetAddress,
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2,
  floorArea: 485,
})

// jsdom's browser language is English.
describe('PropertyList', () => {
  test('shows the count and a card per flat, in the given order', () => {
    render(
      <PropertyList
        properties={[
          flat('a', 'Koivupolku 7 A 4'),
          flat('b', 'Rantatie 15 C 21'),
        ]}
        email="anna@example.com"
        onSignOut={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Flats')
    expect(screen.getByText('2 flats')).toBeInTheDocument()
    const cards = screen.getAllByRole('listitem')
    expect(cards.map((card) => card.textContent)).toEqual([
      'Koivupolku 7 A 4Tampere · 2 rooms 48.5\u00a0m²',
      'Rantatie 15 C 21Tampere · 2 rooms 48.5\u00a0m²',
    ])
    expect(within(cards[0] ?? document.body).getByRole('link')).toHaveAttribute(
      'href',
      '/properties/a/edit',
    )
  })

  test('says "1 flat" for one flat', () => {
    render(
      <PropertyList
        properties={[flat('a', 'Koivupolku 7 A 4')]}
        email="anna@example.com"
        onSignOut={vi.fn()}
      />,
    )
    expect(screen.getByText('1 flat')).toBeInTheDocument()
  })

  test('shows the empty state without flats', () => {
    render(
      <PropertyList
        properties={[]}
        email="anna@example.com"
        onSignOut={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Add your first flat' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    for (const link of screen.getAllByRole('link', { name: 'Add flat' })) {
      expect(link).toHaveAttribute('href', '/properties/new')
    }
  })

  test('shows who is signed in and signs out', async () => {
    const onSignOut = vi.fn()
    render(
      <PropertyList
        properties={[]}
        email="anna@example.com"
        onSignOut={onSignOut}
      />,
    )

    expect(
      screen.getByText('Signed in as anna@example.com'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })
})

describe('Listing flats', () => {
  test('The card shows the owners and their shares', () => {
    render(
      <PropertyList
        properties={[flat('a', 'Kuusikuja 3 B 12')]}
        owners={{
          a: [
            { name: 'Jussi', share: 5000, isYou: false },
            { name: 'Annika', share: 5000, isYou: true },
          ],
        }}
        email="anna@example.com"
        onSignOut={vi.fn()}
      />,
    )

    expect(screen.getByRole('listitem')).toHaveTextContent(
      'You 50% · Jussi 50%',
    )
  })
})
