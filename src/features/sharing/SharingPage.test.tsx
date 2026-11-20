import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  cancelInvitation,
  inviteToProperty,
  leaveProperty,
  removeAccess,
} from './functions'
import type { OwnershipView } from '#/features/ownership/ownership.server'
import type { SharingView } from './sharing.server'
import { SharingPage } from './SharingPage'

// The server functions are replaced: these tests drive the page's states.
// jsdom's browser language is English, so the page is in English.
vi.mock('#/lib/client-log', () => ({ clientLog: { error: vi.fn() } }))
vi.mock('#/features/ownership/functions', () => ({}))
vi.mock('./functions', () => ({
  cancelInvitation: vi.fn(),
  inviteToProperty: vi.fn(),
  leaveProperty: vi.fn(),
  removeAccess: vi.fn(),
}))

const day = (d: number) => new Date(Date.UTC(2026, 10, d, 10))

const ownerView: SharingView = {
  property: { id: 'flat', streetAddress: 'Kuusikuja 3 B 12' },
  role: 'owner',
  people: [
    {
      userId: 'anna',
      name: 'Annika',
      role: 'owner',
      since: day(1),
      isYou: true,
    },
    {
      userId: 'jussi',
      name: 'Jussi',
      role: 'member',
      since: day(12),
      isYou: false,
    },
  ],
  invitations: [
    {
      id: 'i1',
      email: 'liisa@example.com',
      createdAt: day(18),
      expiresAt: day(48),
    },
  ],
}

const memberView: SharingView = {
  ...ownerView,
  role: 'member',
  people: ownerView.people.map((p) => ({ ...p, isYou: p.userId === 'jussi' })),
}

const ownership = (view: SharingView): OwnershipView => ({
  you: view.people.find((p) => p.isYou)?.userId ?? '',
  role: view.role,
  people: view.people.map((p) => ({
    userId: p.userId,
    name: p.name,
    role: p.role,
    since: p.since,
  })),
  periods: [
    {
      validFrom: '2025-03-01',
      validTo: null,
      reason: null,
      shares: [{ userId: 'anna', share: 10000 }],
    },
  ],
  names: { anna: 'Annika' },
})

function setup(view: SharingView) {
  const user = userEvent.setup()
  const onChanged = vi.fn(() => Promise.resolve())
  const onLeft = vi.fn()
  render(
    <SharingPage
      view={view}
      ownership={ownership(view)}
      onChanged={onChanged}
      onLeft={onLeft}
      onBack={vi.fn()}
    />,
  )
  return { user, onChanged, onLeft }
}

beforeEach(() => {
  vi.mocked(inviteToProperty).mockResolvedValue({ ok: true, id: 'i2' })
  vi.mocked(cancelInvitation).mockResolvedValue({ ok: true })
  vi.mocked(removeAccess).mockResolvedValue({ ok: true })
  vi.mocked(leaveProperty).mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Sharing page as the owner', () => {
  test('lists people with roles and the pending invitation', () => {
    setup(ownerView)

    const owners = screen.getByRole('heading', { name: 'Current owners' })
      .nextElementSibling as HTMLElement
    expect(within(owners).getByRole('listitem')).toHaveTextContent(
      'YouOwner since 01/03/2025100%',
    )
    const others = screen.getByRole('heading', { name: 'Others with access' })
      .nextElementSibling as HTMLElement
    const member = within(others).getByRole('listitem')
    expect(member).toHaveTextContent('Jussi')
    expect(member).toHaveTextContent('Member since 12/11/2026')
    expect(
      screen.getByRole('button', { name: 'Change ownership' }),
    ).toBeInTheDocument()
    expect(screen.getByText('liisa@example.com')).toBeInTheDocument()
    expect(
      screen.getByText('Invited 18/11/2026 · valid until 18/12/2026'),
    ).toBeInTheDocument()
  })

  test('sends an invitation and reloads', async () => {
    const { user, onChanged } = setup(ownerView)

    await user.type(
      screen.getByRole('textbox', { name: 'Email' }),
      'Mikko@Example.com',
    )
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))

    expect(inviteToProperty).toHaveBeenCalledWith({
      data: { propertyId: 'flat', email: 'mikko@example.com' },
    })
    expect(onChanged).toHaveBeenCalled()
    expect(
      await screen.findByText('Invitation sent to mikko@example.com'),
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('')
  })

  test('shows a refused address under the field', async () => {
    vi.mocked(inviteToProperty).mockResolvedValue({
      ok: false,
      reason: 'invitation_already_pending',
    })
    const { user } = setup(ownerView)

    const field = screen.getByRole('textbox', { name: 'Email' })
    await user.type(field, 'liisa@example.com')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))

    expect(
      await screen.findByText(/already been sent to this address/),
    ).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  test('shows a limit as an alert', async () => {
    vi.mocked(inviteToProperty).mockResolvedValue({
      ok: false,
      reason: 'invitation_limit_reached',
    })
    const { user } = setup(ownerView)

    await user.type(
      screen.getByRole('textbox', { name: 'Email' }),
      'pekka@example.com',
    )
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many open invitations',
    )
  })

  test('cancels an invitation', async () => {
    const { user, onChanged } = setup(ownerView)

    await user.click(
      screen.getByRole('button', {
        name: 'Cancel the invitation to liisa@example.com',
      }),
    )

    expect(cancelInvitation).toHaveBeenCalledWith({
      data: { invitationId: 'i1' },
    })
    expect(onChanged).toHaveBeenCalled()
  })

  test('removes a member after confirming', async () => {
    const { user, onChanged } = setup(ownerView)

    await user.click(
      screen.getByRole('button', { name: 'Remove Jussi from the flat' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Remove Jussi from the flat?',
    })
    expect(dialog).toHaveTextContent(
      'Jussi will no longer see Kuusikuja 3 B 12',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Remove access' }),
    )

    expect(removeAccess).toHaveBeenCalledWith({
      data: { propertyId: 'flat', userId: 'jussi' },
    })
    expect(onChanged).toHaveBeenCalled()
  })

  test('does nothing when the dialog is cancelled', async () => {
    const { user } = setup(ownerView)

    await user.click(
      screen.getByRole('button', { name: 'Remove Jussi from the flat' }),
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancel',
      }),
    )

    expect(removeAccess).not.toHaveBeenCalled()
  })

  test('has no leave button', () => {
    setup(ownerView)
    expect(
      screen.queryByRole('button', { name: 'Leave the flat' }),
    ).not.toBeInTheDocument()
  })
})

describe('Sharing page as a member', () => {
  test('has no invite form, remove or cancel buttons', () => {
    setup(memberView)

    expect(
      screen.queryByRole('textbox', { name: 'Email' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /^Remove|^Cancel|^Change ownership/,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'Only owners can invite people, remove access and change the ownership.',
      ),
    ).toBeInTheDocument()
  })

  test('leaves the flat after confirming', async () => {
    const { user, onLeft } = setup(memberView)

    await user.click(screen.getByRole('button', { name: 'Leave the flat' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Leave the flat?' })).getByRole(
        'button',
        { name: 'Leave' },
      ),
    )

    expect(leaveProperty).toHaveBeenCalledWith({
      data: { propertyId: 'flat' },
    })
    expect(onLeft).toHaveBeenCalled()
  })

  test('shows why leaving failed', async () => {
    vi.mocked(leaveProperty).mockResolvedValue({
      ok: false,
      reason: 'sharing_owner_only',
    })
    const { user, onLeft } = setup(memberView)

    await user.click(screen.getByRole('button', { name: 'Leave the flat' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Leave',
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only the owner can do this',
    )
    expect(onLeft).not.toHaveBeenCalled()
  })
})
