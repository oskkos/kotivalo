import { render, screen, within } from '@testing-library/react'
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
        name="Annika"
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
        name="Annika"
      />,
    )
    expect(screen.getByText('1 flat')).toBeInTheDocument()
  })

  test('shows the empty state without flats', () => {
    render(<PropertyList properties={[]} name="Annika" />)

    expect(
      screen.getByRole('heading', { name: 'Add your first flat' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    for (const link of screen.getAllByRole('link', { name: 'Add flat' })) {
      expect(link).toHaveAttribute('href', '/properties/new')
    }
  })

  test("the header opens the account page with the name's initial", () => {
    render(<PropertyList properties={[]} name="Annika" />)

    const account = screen.getByRole('link', { name: 'Account' })
    expect(account).toHaveAttribute('href', '/account')
    expect(account).toHaveTextContent('A')
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
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
        name="Annika"
      />,
    )

    expect(screen.getByRole('listitem')).toHaveTextContent(
      'You 50% · Jussi 50%',
    )
  })
})
