import { expect, test, type Page } from '@playwright/test'
import { inbox, signIn, uniqueEmail, waitForHydration } from './support/sign-in'

test.use({ locale: 'fi-FI' })

async function openAccount(page: Page): Promise<void> {
  await page.goto('/account')
  await waitForHydration(page)
}

const languageButton = (page: Page, name: string) =>
  page
    .getByRole('group', { name: /^(Kieli|Språk|Language)$/ })
    .getByRole('button', { name })

test.describe('The account page', () => {
  test('The account page needs a signed-in user', async ({ page }) => {
    await page.goto('/account')
    await expect(page).toHaveURL('/sign-in')
  })

  test('Opening the account page from the flats list', async ({ page }) => {
    const email = uniqueEmail('tili')
    await signIn(page, email, 'Annika')
    await waitForHydration(page)

    const account = page.getByRole('link', { name: 'Tili' })
    await expect(account).toHaveText('A')
    await account.click()
    await expect(page).toHaveURL('/account')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Tili' }),
    ).toBeVisible()
    await expect(page.getByText('Annika', { exact: true })).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()
    await page.getByRole('button', { name: 'Takaisin asuntoihin' }).click()
    await expect(page).toHaveURL('/')
  })
})

test.describe('Changing the display name', () => {
  test('Saving a new name', async ({ page }) => {
    await signIn(page, uniqueEmail('nimi'), 'Annika')
    await openAccount(page)

    await page.getByRole('button', { name: 'Muuta nimeä' }).click()
    const dialog = page.getByRole('dialog', { name: 'Muuta nimeä' })
    await dialog.getByRole('textbox', { name: 'Nimi' }).fill('Anni')
    await dialog.getByRole('button', { name: 'Tallenna' }).click()

    await expect(dialog).toBeHidden()
    await expect(page.getByText('Anni', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText('Anni', { exact: true })).toBeVisible()
  })

  test('An empty new name is not saved', async ({ page }) => {
    await signIn(page, uniqueEmail('tyhja'), 'Annika')
    await openAccount(page)

    await page.getByRole('button', { name: 'Muuta nimeä' }).click()
    const dialog = page.getByRole('dialog', { name: 'Muuta nimeä' })
    await dialog.getByRole('textbox', { name: 'Nimi' }).fill('   ')
    await dialog.getByRole('button', { name: 'Tallenna' }).click()

    await expect(dialog.getByText('Kirjoita nimi.')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Annika', { exact: true })).toBeVisible()
  })
})

test.describe('Choosing the language on the account page', () => {
  test('Switching from Finnish to Swedish', async ({ page, context }) => {
    await signIn(page, uniqueEmail('kieli'))
    await openAccount(page)
    await expect(languageButton(page, 'Suomi')).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await languageButton(page, 'Svenska').click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Konto' }),
    ).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'sv')
    await expect(languageButton(page, 'Svenska')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const cookies = await context.cookies()
    expect(cookies.find((c) => c.name === 'kotivalo_locale')?.value).toBe('sv')
  })

  test('The new language follows the user to another device', async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail('laite')
    await signIn(page, email)
    await openAccount(page)
    await languageButton(page, 'English').click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    // Another device, in Finnish.
    const other = await browser.newContext({ locale: 'fi-FI' })
    const otherPage = await other.newPage()
    await signIn(otherPage, email)

    expect((await inbox(otherPage.request, email)).at(-1)?.subject).toMatch(
      /is your Kotivalo sign-in code$/,
    )
    await expect(otherPage.locator('html')).toHaveAttribute('lang', 'en')
    await other.close()
  })

  test('Switching back to Finnish', async ({ page }) => {
    await signIn(page, uniqueEmail('takaisin'))
    await openAccount(page)
    await languageButton(page, 'English').click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Account' }),
    ).toBeVisible()
    await waitForHydration(page)

    await languageButton(page, 'Suomi').click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Tili' }),
    ).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'fi')
  })
})
