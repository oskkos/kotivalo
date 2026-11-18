import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { Home } from './index'

vi.mock('#/features/authentication/functions', () => ({}))

describe('Home page', () => {
  test('shows the brand name as the main heading', () => {
    render(<Home email="uusi@example.com" onSignOut={vi.fn()} />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'kotivalo' }),
    ).toBeInTheDocument()
  })

  test('shows who is signed in and signs out', async () => {
    const onSignOut = vi.fn(() => Promise.resolve())
    render(<Home email="uusi@example.com" onSignOut={onSignOut} />)

    expect(
      screen.getByText('Signed in as uusi@example.com'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })
})
