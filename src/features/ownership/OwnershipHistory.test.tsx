import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { correctFirstOwnershipDate, undoOwnershipChange } from './functions'
import { CurrentOwners, OwnershipHistory } from './OwnershipHistory'
import type { Period } from './periods'

// jsdom's browser language is English.
vi.mock('#/lib/client-log', () => ({ clientLog: { error: vi.fn() } }))
vi.mock('./functions', () => ({
  correctFirstOwnershipDate: vi.fn(),
  undoOwnershipChange: vi.fn(),
}))

const periods: Period[] = [
  {
    validFrom: '2025-03-01',
    validTo: null,
    reason: 'sale',
    shares: [
      { userId: 'annika', share: 5000 },
      { userId: 'jussi', share: 5000 },
    ],
  },
  {
    validFrom: '2022-06-12',
    validTo: '2025-02-28',
    reason: null,
    shares: [{ userId: 'annika', share: 10000 }],
  },
]
const names = { annika: 'Annika', jussi: 'Jussi' }

function setup(isOwner = true) {
  const user = userEvent.setup()
  const onChanged = vi.fn(() => Promise.resolve())
  render(
    <OwnershipHistory
      propertyId="flat"
      periods={periods}
      names={names}
      you="annika"
      isOwner={isOwner}
      onChanged={onChanged}
    />,
  )
  return { user, onChanged }
}

beforeEach(() => {
  vi.mocked(undoOwnershipChange).mockResolvedValue({ ok: true })
  vi.mocked(correctFirstOwnershipDate).mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Current owners', () => {
  test('lists the current split with the start date', () => {
    render(<CurrentOwners periods={periods} names={names} you="annika" />)
    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('You')
    expect(rows[0]).toHaveTextContent('Owner since 01/03/2025')
    expect(rows[0]).toHaveTextContent('50%')
    expect(rows[1]).toHaveTextContent('Jussi')
  })
})

describe('Ownership history', () => {
  test('lists the periods newest first with their reasons', () => {
    setup()
    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('From 01/03/2025')
    expect(rows[0]).toHaveTextContent('You 50% · Jussi 50%')
    expect(rows[0]).toHaveTextContent('Sale · current')
    expect(rows[1]).toHaveTextContent('From 12/06/2022')
    expect(rows[1]).toHaveTextContent('First ownership period')
  })

  test('an owner undoes the latest change after confirming', async () => {
    const { user, onChanged } = setup()

    await user.click(screen.getByRole('button', { name: 'Undo change' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Undo the ownership change from 01/03/2025?',
    })
    expect(dialog).toHaveTextContent('goes back to You 100% from 12/06/2022')
    await user.click(
      within(dialog).getByRole('button', { name: 'Undo change' }),
    )

    expect(undoOwnershipChange).toHaveBeenCalledWith({
      data: { propertyId: 'flat' },
    })
    expect(onChanged).toHaveBeenCalled()
  })

  test('an owner corrects the first date', async () => {
    const { user, onChanged } = setup()

    await user.click(screen.getByRole('button', { name: 'Correct date' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Correct the ownership start date',
    })
    expect(dialog).toHaveTextContent(
      'The date must be before the next ownership change (01/03/2025).',
    )
    const field = within(dialog).getByRole('textbox', { name: 'Owned since' })
    await user.clear(field)
    await user.type(field, '01/01/2020')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(correctFirstOwnershipDate).toHaveBeenCalledWith({
      data: { propertyId: 'flat', date: '01/01/2020' },
    })
    expect(onChanged).toHaveBeenCalled()
  })

  test('a member sees the history without actions', () => {
    setup(false)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
