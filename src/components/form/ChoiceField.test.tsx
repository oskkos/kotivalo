import { useForm } from '@tanstack/react-form'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'
import type { Reason } from '#/lib/reasons'
import { ChoiceField } from './ChoiceField'

const schema = z.object({
  rooms: z.number().min(1, { error: 'room_count_required' }),
})

function RoomsForm(props: {
  initial?: number
  reason?: Reason
  onSubmit?: (rooms: number) => void
}) {
  const form = useForm({
    defaultValues: { rooms: props.initial ?? 0 },
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: ({ value }) => props.onSubmit?.(value.rooms),
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field name="rooms">
        {(field) => (
          <ChoiceField
            field={field}
            label="Rooms"
            reason={props.reason}
            choices={[
              { value: 1, label: 'One' },
              { value: 2, label: 'Two' },
            ]}
          />
        )}
      </form.Field>
      <button type="submit">Save</button>
    </form>
  )
}

const group = () => screen.getByRole('group', { name: 'Rooms' })

describe('ChoiceField', () => {
  test('marks the current value as pressed', () => {
    render(<RoomsForm initial={2} />)
    expect(screen.getByRole('button', { name: 'Two' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('sets the value when a choice is selected', async () => {
    const onSubmit = vi.fn()
    render(<RoomsForm onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('button', { name: 'One' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(onSubmit).toHaveBeenCalledWith(1)
  })

  test('shows the reason under the group after submitting without a choice', async () => {
    render(<RoomsForm />)
    expect(group()).not.toHaveAccessibleDescription()

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    // jsdom's browser language is English.
    expect(group()).toHaveAccessibleDescription('Choose the number of rooms.')
  })

  test('shows a reason given from outside the form', () => {
    render(<RoomsForm initial={1} reason="room_count_required" />)
    expect(group()).toHaveAccessibleDescription('Choose the number of rooms.')
  })
})
