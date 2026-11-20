import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { setDisplayName } from '#/features/authentication/functions'
import { AccountPage } from './AccountPage'
import { setAccountLanguage } from './functions'

// jsdom's browser language is English, so the page is in English.
vi.mock('#/lib/client-log', () => ({ clientLog: { error: vi.fn() } }))
vi.mock('./functions', () => ({ setAccountLanguage: vi.fn() }))
vi.mock('#/features/authentication/functions', () => ({
  setDisplayName: vi.fn(),
}))
const saveLanguage = vi.mocked(setAccountLanguage)
const saveName = vi.mocked(setDisplayName)

function setup() {
  const user = userEvent.setup()
  const props = {
    onBack: vi.fn(),
    onSignOut: vi.fn(),
    onNameSaved: vi.fn(() => Promise.resolve()),
    onLanguageChanged: vi.fn(),
  }
  render(
    <AccountPage
      name="Annika"
      email="annika@example.com"
      locale="en"
      {...props}
    />,
  )
  return { user, ...props }
}

const languageButton = (name: string) =>
  within(screen.getByRole('group', { name: 'Language' })).getByRole('button', {
    name,
  })

afterEach(() => {
  vi.clearAllMocks()
})

describe('Account page', () => {
  test('shows the name, the address and the actions', async () => {
    const { user, onBack, onSignOut } = setup()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Account' }),
    ).toBeVisible()
    expect(screen.getByText('Annika')).toBeVisible()
    expect(screen.getByText('annika@example.com')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Back to flats' }))
    expect(onBack).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })

  test('marks the current language and names each in itself', () => {
    setup()

    expect(languageButton('English')).toHaveAttribute('aria-pressed', 'true')
    expect(languageButton('Suomi')).toHaveAttribute('aria-pressed', 'false')
    expect(languageButton('Suomi')).toHaveAttribute('lang', 'fi')
    expect(languageButton('Svenska')).toHaveAttribute('lang', 'sv')
  })

  test('stores a new language, then loads the app in it', async () => {
    saveLanguage.mockResolvedValue({ ok: true, changed: true })
    const { user, onLanguageChanged } = setup()

    await user.click(languageButton('Svenska'))

    expect(saveLanguage).toHaveBeenCalledWith({ data: { locale: 'sv' } })
    expect(onLanguageChanged).toHaveBeenCalledWith('sv')
    expect(languageButton('Suomi')).toBeDisabled()
  })

  test('the current language does nothing', async () => {
    const { user, onLanguageChanged } = setup()

    await user.click(languageButton('English'))

    expect(saveLanguage).not.toHaveBeenCalled()
    expect(onLanguageChanged).not.toHaveBeenCalled()
  })

  test('a failed save shows an alert and keeps the language', async () => {
    saveLanguage.mockRejectedValue(new Error('boom'))
    const { user, onLanguageChanged } = setup()

    await user.click(languageButton('Suomi'))

    expect(await screen.findByRole('alert')).toBeVisible()
    expect(onLanguageChanged).not.toHaveBeenCalled()
    expect(languageButton('Suomi')).toBeEnabled()
  })
})

describe('Changing the display name', () => {
  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Change name' }))
    const dialog = screen.getByRole('dialog', { name: 'Change name' })
    return {
      dialog,
      field: within(dialog).getByRole('textbox', { name: 'Name' }),
      save: () =>
        user.click(within(dialog).getByRole('button', { name: 'Save' })),
    }
  }

  test('Saving a new name', async () => {
    saveName.mockResolvedValue({ ok: true })
    const { user, onNameSaved } = setup()
    const { field, save } = await openDialog(user)

    expect(field).toHaveValue('Annika')
    await user.clear(field)
    await user.type(field, ' Anni ')
    await save()

    expect(saveName).toHaveBeenCalledWith({ data: { name: 'Anni' } })
    expect(onNameSaved).toHaveBeenCalledOnce()
    await vi.waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  test('An empty new name is not saved', async () => {
    const { user } = setup()
    const { dialog, field, save } = await openDialog(user)

    await user.clear(field)
    await save()

    expect(field).toHaveAccessibleDescription('Enter a name.')
    expect(saveName).not.toHaveBeenCalled()
    expect(dialog).toBeVisible()
  })

  test('Cancelling keeps the old name', async () => {
    const { user } = setup()
    const { dialog, field } = await openDialog(user)

    await user.clear(field)
    await user.type(field, 'Anni')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await vi.waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(saveName).not.toHaveBeenCalled()
    expect(screen.getByText('Annika')).toBeVisible()
  })
})
