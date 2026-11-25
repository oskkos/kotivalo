import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { BottomNav } from './BottomNav'

// jsdom's browser language is English. Links need a router; an anchor is
// enough here.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...rest }: { to: string; children?: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

describe('bottom navigation', () => {
  test('marks the current page and links the four items', () => {
    render(<BottomNav current="account" />)
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/transactions/new',
      '/year-summary',
      '/account',
    ])
    expect(within(nav).getByRole('link', { name: 'Account' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      within(nav).getByRole('link', { name: 'Flats' }),
    ).not.toHaveAttribute('aria-current')
    expect(within(nav).getByRole('link', { name: 'New entry' })).toBeVisible()
  })

  test('marks Taxes on the year summary', () => {
    render(<BottomNav current="year-summary" />)
    expect(screen.getByRole('link', { name: 'Taxes' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
