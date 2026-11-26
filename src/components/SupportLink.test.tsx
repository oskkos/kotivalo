import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { SupportLink } from './SupportLink'

// jsdom's browser language is English.
describe('SupportLink', () => {
  test('shows the address as text and links to it', () => {
    render(<SupportLink />)
    const link = screen.getByRole('link', { name: 'support@kotivalo.app' })
    expect(link).toHaveAttribute('href', 'mailto:support@kotivalo.app')
  })
})
