import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { changeOwnership } from './functions'
import { OwnershipChangeForm } from './OwnershipChangeForm'

// jsdom's browser language is English, so the form is in English.
vi.mock('#/lib/client-log', () => ({ clientLog: { error: vi.fn() } }))
vi.mock('./functions', () => ({ changeOwnership: vi.fn() }))

const since = new Date(Date.UTC(2026, 10, 1))
const people = [
  { userId: 'jussi', name: 'Jussi', role: 'member' as const, since },
  { userId: 'annika', name: 'Annika', role: 'owner' as const, since },
]
const names = { annika: 'Annika', jussi: 'Jussi' }

function setup() {
  const user = userEvent.setup()
  const onSaved = vi.fn(() => Promise.resolve())
  render(
    <OwnershipChangeForm
      propertyId="flat"
      people={people}
      names={names}
      you="annika"
      current={[{ userId: 'annika', share: 10000 }]}
      currentStart="2022-06-12"
      onSaved={onSaved}
      onCancel={vi.fn()}
    />,
  )
  const share = (name: string) =>
    screen.getByRole('textbox', { name: `Share (%), ${name}` })
  const save = () =>
    user.click(screen.getByRole('button', { name: 'Save ownership change' }))
  return { user, onSaved, share, save }
}

beforeEach(() => {
  vi.mocked(changeOwnership).mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Ownership change form', () => {
  test('starts from the current split, you first', () => {
    const { share } = setup()
    expect(share('You')).toHaveValue('100')
    expect(share('Jussi')).toHaveValue('0')
    expect(screen.getByText('Total 100%')).toBeInTheDocument()
  })

  test('saves an equal split with a date and a reason', async () => {
    const { user, onSaved, save } = setup()

    await user.click(screen.getByRole('button', { name: 'Equal shares' }))
    await user.type(screen.getByRole('textbox', { name: 'From' }), '01/03/2025')
    expect(
      screen.getByText('From 01/03/2025: You 50% · Jussi 50%'),
    ).toBeInTheDocument()
    await save()

    expect(changeOwnership).toHaveBeenCalledWith({
      data: {
        propertyId: 'flat',
        from: '01/03/2025',
        reason: 'sale',
        shares: [
          { userId: 'annika', percent: '50' },
          { userId: 'jussi', percent: '50' },
        ],
        removeAccess: [],
      },
    })
    expect(onSaved).toHaveBeenCalled()
  })

  test("says that a change on the current period's start corrects it", async () => {
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: 'Equal shares' }))
    await user.type(screen.getByRole('textbox', { name: 'From' }), '12/06/2022')

    expect(
      screen.getByText(
        "The date is the current period's start, so this corrects its split; no new period is added.",
      ),
    ).toBeInTheDocument()
  })

  test('shows the live total when the shares do not add up', async () => {
    const { user, share } = setup()

    await user.clear(share('You'))
    await user.type(share('You'), '60')
    await user.clear(share('Jussi'))
    await user.type(share('Jussi'), '30')

    expect(
      screen.getByText('The shares add up to 90%. They must add up to 100%.'),
    ).toBeInTheDocument()
  })

  test('offers removing the access of someone at 0 %', async () => {
    const { user, save } = setup()

    await user.click(
      screen.getByRole('checkbox', { name: /Remove Jussi from the flat/ }),
    )
    await user.type(screen.getByRole('textbox', { name: 'From' }), '01/03/2025')
    await save()

    expect(changeOwnership).toHaveBeenCalledWith({
      data: expect.objectContaining({ removeAccess: ['jussi'] }) as unknown,
    })
  })

  test('shows a date the server refuses under the date field', async () => {
    vi.mocked(changeOwnership).mockResolvedValue({
      ok: false,
      reason: 'ownership_date_too_early',
    })
    const { user, onSaved, save } = setup()

    await user.type(screen.getByRole('textbox', { name: 'From' }), '01/03/2020')
    await save()

    expect(
      await screen.findByText(
        "The change can't start before the current ownership period does.",
      ),
    ).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })
})
