import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { requestSignInCode, verifySignInCode } from './functions'
import { SignInPage } from './SignInPage'

// The server functions are replaced: these tests drive the page's states.
// jsdom's browser language is English, so the page is in English.
vi.mock('./functions', () => ({
  requestSignInCode: vi.fn(),
  verifySignInCode: vi.fn(),
}))
const requestCode = vi.mocked(requestSignInCode)
const verifyCode = vi.mocked(verifySignInCode)

function setup() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const onSignedIn = vi.fn()
  render(<SignInPage onSignedIn={onSignedIn} />)
  return { user, onSignedIn }
}

async function toCodeStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByRole('textbox', { name: 'Email' }),
    'Omistaja@Example.com',
  )
  await user.click(screen.getByRole('button', { name: 'Send code' }))
  await screen.findByRole('heading', { name: 'Enter the code' })
}

const resendButton = () =>
  screen.getByRole('button', { name: 'Send a new code' })

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  requestCode.mockResolvedValue({ ok: true })
  verifyCode.mockResolvedValue({ ok: true, locale: 'en' })
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('Sign-in page', () => {
  test('sends the normalised address and shows where the code went', async () => {
    const { user } = setup()
    await toCodeStep(user)

    expect(requestCode).toHaveBeenCalledWith({
      data: { email: 'omistaja@example.com' },
    })
    expect(screen.getByText('omistaja@example.com')).toBeInTheDocument()
  })

  test('shows a field error for an invalid address and sends nothing', async () => {
    const { user } = setup()
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'mikko@')
    await user.click(screen.getByRole('button', { name: 'Send code' }))

    expect(
      screen.getByRole('textbox', { name: 'Email' }),
    ).toHaveAccessibleDescription(
      'Check the email address, for example name@example.com.',
    )
    expect(requestCode).not.toHaveBeenCalled()
  })

  test.each([
    ['limit_reached', 'Too many attempts'],
    ['email_quota', "Codes can't be sent right now"],
    ['email_busy', 'Sending is busy'],
    ['email_failed', 'Sending failed'],
  ] as const)(
    'shows %s as an alert on the email step',
    async (reason, title) => {
      requestCode.mockResolvedValue({ ok: false, reason })
      const { user } = setup()
      await user.type(
        screen.getByRole('textbox', { name: 'Email' }),
        'uusi@example.com',
      )
      await user.click(screen.getByRole('button', { name: 'Send code' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(title)
      expect(
        screen.getByRole('heading', { name: 'Sign in to Kotivalo' }),
      ).toBeInTheDocument()
    },
  )

  test('the sixth digit signs in', async () => {
    const { user, onSignedIn } = setup()
    await toCodeStep(user)

    await user.type(screen.getByLabelText('Sign-in code'), '482913')

    expect(verifyCode).toHaveBeenCalledWith({
      data: { email: 'omistaja@example.com', code: '482913' },
    })
    expect(onSignedIn).toHaveBeenCalledOnce()
  })

  test('a wrong code shows an error under the field', async () => {
    verifyCode.mockResolvedValue({ ok: false, reason: 'code_wrong' })
    const { user, onSignedIn } = setup()
    await toCodeStep(user)

    await user.type(screen.getByLabelText('Sign-in code'), '000000')

    const field = screen.getByLabelText('Sign-in code')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription(
      "The code isn't right. Check the code and try again.",
    )
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  test('too many wrong attempts show an alert', async () => {
    verifyCode.mockResolvedValue({ ok: false, reason: 'code_attempts_used' })
    const { user } = setup()
    await toCodeStep(user)

    await user.type(screen.getByLabelText('Sign-in code'), '000000')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many wrong attempts',
    )
    expect(resendButton()).toBeEnabled()
  })
})

describe('Sign-in page when a request fails unexpectedly', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  test('the email step shows an alert', async () => {
    requestCode.mockRejectedValue(new Error('network down'))
    const { user } = setup()
    await user.type(
      screen.getByRole('textbox', { name: 'Email' }),
      'uusi@example.com',
    )
    await user.click(screen.getByRole('button', { name: 'Send code' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong',
    )
    expect(screen.getByRole('button', { name: 'Send code' })).toBeEnabled()
  })

  test('the code step shows an alert', async () => {
    verifyCode.mockRejectedValue(new Error('server error'))
    const { user, onSignedIn } = setup()
    await toCodeStep(user)

    await user.type(screen.getByLabelText('Sign-in code'), '482913')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong',
    )
    expect(onSignedIn).not.toHaveBeenCalled()
  })
})

describe('Requesting a new code', () => {
  test('A new code can be requested after 30 seconds', async () => {
    const { user } = setup()
    await toCodeStep(user)

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(resendButton()).toBeDisabled()
    expect(
      screen.getByText('You can ask for a new code in 0:20.'),
    ).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    expect(resendButton()).toBeEnabled()
    await user.click(resendButton())
    expect(requestCode).toHaveBeenCalledTimes(2)
    expect(requestCode).toHaveBeenLastCalledWith({
      data: { email: 'omistaja@example.com' },
    })
    // The new send starts a new wait.
    expect(resendButton()).toBeDisabled()
  })

  test('An expired code offers a new one at once', async () => {
    verifyCode.mockResolvedValue({ ok: false, reason: 'code_expired' })
    const { user } = setup()
    await toCodeStep(user)
    expect(resendButton()).toBeDisabled()

    await user.type(screen.getByLabelText('Sign-in code'), '482913')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The code has expired',
    )
    expect(resendButton()).toBeEnabled()
  })

  test('Changing the address goes back to the email step', async () => {
    const { user } = setup()
    await toCodeStep(user)

    await user.click(
      screen.getByRole('button', { name: 'Change email address' }),
    )

    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue(
      'omistaja@example.com',
    )
  })
})
