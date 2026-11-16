import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { Home } from './index'

describe('Home page', () => {
  test('shows the brand name as the main heading', () => {
    render(<Home />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'kotivalo' }),
    ).toBeInTheDocument()
  })
})
