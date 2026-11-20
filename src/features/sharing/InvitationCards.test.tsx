import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { acceptInvitation, declineInvitation } from './functions'
import { InvitationCards } from './InvitationCards'

// jsdom's browser language is English, so the cards are in English.
vi.mock('#/lib/client-log', () => ({ clientLog: { error: vi.fn() } }))
vi.mock('./functions', () => ({
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
}))

const invitation = {
  id: 'i1',
  propertyId: 'flat',
  streetAddress: 'Kuusikuja 3 B 12',
  city: 'Tampere',
  inviterName: 'Annika',
  expiresAt: new Date(Date.UTC(2026, 11, 18, 10)),
}

function setup() {
  const user = userEvent.setup()
  const onAnswered = vi.fn(() => Promise.resolve())
  render(<InvitationCards invitations={[invitation]} onAnswered={onAnswered} />)
  const card = within(
    screen.getByRole('list', { name: 'Invitations' }),
  ).getByRole('listitem')
  return { user, onAnswered, card }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('Invitation cards', () => {
  test('show who shared which flat and until when', () => {
    const { card } = setup()

    expect(card).toHaveTextContent('Annika shared a flat with you')
    expect(card).toHaveTextContent('Kuusikuja 3 B 12')
    expect(card).toHaveTextContent('Tampere · valid until 18/12/2026')
  })

  test('accepting reloads the list and says so', async () => {
    vi.mocked(acceptInvitation).mockResolvedValue({
      ok: true,
      propertyId: 'flat',
    })
    const { user, onAnswered, card } = setup()

    await user.click(within(card).getByRole('button', { name: 'Accept' }))

    expect(acceptInvitation).toHaveBeenCalledWith({
      data: { invitationId: 'i1' },
    })
    expect(onAnswered).toHaveBeenCalled()
    expect(
      await screen.findByText('Kuusikuja 3 B 12 is now on your list.'),
    ).toBeInTheDocument()
  })

  test('declining reloads the list and says so', async () => {
    vi.mocked(declineInvitation).mockResolvedValue({ ok: true })
    const { user, onAnswered, card } = setup()

    await user.click(within(card).getByRole('button', { name: 'Decline' }))

    expect(declineInvitation).toHaveBeenCalledWith({
      data: { invitationId: 'i1' },
    })
    expect(onAnswered).toHaveBeenCalled()
    expect(await screen.findByText('Invitation declined.')).toBeInTheDocument()
  })

  test('a cancelled invitation shows why and reloads', async () => {
    vi.mocked(acceptInvitation).mockResolvedValue({
      ok: false,
      reason: 'invitation_not_found',
    })
    const { user, onAnswered, card } = setup()

    await user.click(within(card).getByRole('button', { name: 'Accept' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The invitation is no longer valid',
    )
    expect(onAnswered).toHaveBeenCalled()
  })

  test('nothing is shown without invitations', () => {
    render(<InvitationCards invitations={[]} onAnswered={vi.fn()} />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
