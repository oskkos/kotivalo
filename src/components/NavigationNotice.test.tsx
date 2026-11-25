import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { NavigationNotice } from './NavigationNotice'

const navigate = vi.fn()
let state: { notice?: string } = {}

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useLocation: (options: {
    select: (location: { state: { notice?: string } }) => unknown
  }) => options.select({ state }),
}))

beforeEach(() => {
  navigate.mockClear()
  state = {}
})

describe('NavigationNotice', () => {
  test('shows the notice from the history state and clears the state', () => {
    state = { notice: 'Koivupolku 7 A 4 arkistoitu' }

    render(<NavigationNotice />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Koivupolku 7 A 4 arkistoitu',
    )
    expect(navigate).toHaveBeenCalledTimes(1)
    const call = navigate.mock.calls[0]?.[0] as {
      replace: boolean
      state: (previous: object) => { notice?: string }
    }
    expect(call.replace).toBe(true)
    expect(call.state({ notice: 'x', other: 1 })).toEqual({
      notice: undefined,
      other: 1,
    })
  })

  test('shows nothing without a notice, and clears nothing', () => {
    render(<NavigationNotice />)

    expect(screen.queryByRole('status')).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
  })

  test('keeps showing the notice after the state is cleared', () => {
    state = { notice: 'Kuusikuja 3 B 12 poistettu' }
    const { rerender } = render(<NavigationNotice />)
    state = {}

    rerender(<NavigationNotice />)

    expect(screen.getByRole('status')).toHaveTextContent('poistettu')
    expect(navigate).toHaveBeenCalledTimes(1)
  })
})
