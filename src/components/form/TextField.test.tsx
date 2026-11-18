import { useForm } from '@tanstack/react-form'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { requestCodeInput } from '#/features/authentication/schemas'
import type { Reason } from '#/lib/reasons'
import { TextField } from './TextField'

function EmailForm({ reason }: { reason?: Reason }) {
  const form = useForm({
    defaultValues: { email: '' },
    validators: { onChange: requestCodeInput },
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field name="email">
        {(field) => <TextField field={field} label="Email" reason={reason} />}
      </form.Field>
      <button type="submit">Send</button>
    </form>
  )
}

describe('TextField', () => {
  test('shows no error while the first value is being typed', async () => {
    render(<EmailForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'mikko@')
    expect(screen.getByLabelText('Email')).not.toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  test('shows the reason as text in the user language after submitting', async () => {
    render(<EmailForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'mikko@esimerkki')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(
      // jsdom's browser language is English.
      'Check the email address, for example name@example.com.',
    )
  })

  test('shows a reason from the server', () => {
    render(<EmailForm reason="email_invalid" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  test('clears the error once the value is valid', async () => {
    render(<EmailForm />)
    const input = screen.getByLabelText('Email')
    await userEvent.type(input, 'mikko@esimerkki')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await userEvent.type(input, '.fi')
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
  })
})
