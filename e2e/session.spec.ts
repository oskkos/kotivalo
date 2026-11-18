import { expect, test } from '@playwright/test'
import { signIn, uniqueEmail } from './support/sign-in'

test.use({ locale: 'fi-FI' })

test.describe('Pages for signed-in users only', () => {
  test('A visitor is sent to sign in', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/sign-in')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Kirjaudu Kotivaloon' }),
    ).toBeVisible()
  })

  test('A signed-in user skips the sign-in page', async ({ page }) => {
    await signIn(page, uniqueEmail('kirjautunut'))
    await page.goto('/sign-in')
    await expect(page).toHaveURL('/')
  })
})

test.describe('Signing out', () => {
  test('Signing out ends the session', async ({ page }) => {
    await signIn(page, uniqueEmail('ulos'))

    await page.getByRole('button', { name: 'Kirjaudu ulos' }).click()
    await expect(page).toHaveURL('/sign-in')

    await page.goto('/')
    await expect(page).toHaveURL('/sign-in')
  })
})

test.describe("The user's language is stored on the account", () => {
  test('Signing in on another device uses the stored language', async ({
    page,
    browser,
  }) => {
    // The account is created in Swedish.
    const email = uniqueEmail('svensk')
    await page.goto('/sign-in')
    await page.getByRole('button', { name: 'Kieli: Suomi' }).click()
    await page.getByRole('menuitem', { name: 'Svenska' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'sv')
    await signIn(page, email)

    // Another device: a Finnish browser without the language cookie.
    const other = await browser.newContext({ locale: 'fi-FI' })
    const otherPage = await other.newPage()
    await otherPage.goto('/sign-in')
    await expect(otherPage.locator('html')).toHaveAttribute('lang', 'fi')
    await signIn(otherPage, email)

    await expect(otherPage.locator('html')).toHaveAttribute('lang', 'sv')
    await expect(otherPage.getByText(`Inloggad som ${email}`)).toBeVisible()
    const cookies = await other.cookies()
    expect(cookies.find((c) => c.name === 'kotivalo_locale')?.value).toBe('sv')
    await other.close()
  })
})
