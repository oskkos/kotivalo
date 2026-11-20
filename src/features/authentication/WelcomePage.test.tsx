import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { setDisplayName } from './functions'
import { WelcomePage } from './WelcomePage'

// jsdom's browser language is English, so the page is in English.
vi.mock('#/lib/client-log', () => ({ clientLog: { error: vi.fn() } }))
vi.mock('./functions', () => ({ setDisplayName: vi.fn() }))
const save = vi.mocked(setDisplayName)

function setup() {
  const user = userEvent.setup()
  const onSaved = vi.fn()
  render(<WelcomePage onSaved={onSaved} />)
  const field = screen.getByRole('textbox', { name: 'Name' })
  const submit = () =>
    user.click(screen.getByRole('button', { name: 'Continue' }))
  return { user, onSaved, field, submit }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('Welcome page', () => {
  test('saves the trimmed name and moves on', async () => {
    save.mockResolvedValue({ ok: true })
    const { user, onSaved, field, submit } = setup()

    await user.type(field, '  Annika ')
    await submit()

    expect(save).toHaveBeenCalledWith({ data: { name: 'Annika' } })
    expect(onSaved).toHaveBeenCalledOnce()
  })

  test('an empty name shows an error and saves nothing', async () => {
    const { user, onSaved, field, submit } = setup()

    await user.type(field, '   ')
    await submit()

    expect(await screen.findByText('Enter a name.')).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(save).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  test('a failed save shows an alert and stays on the page', async () => {
    save.mockRejectedValue(new TypeError('Failed to fetch'))
    const { user, onSaved, field, submit } = setup()

    await user.type(field, 'Annika')
    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('No connection')
    expect(onSaved).not.toHaveBeenCalled()
  })
})
