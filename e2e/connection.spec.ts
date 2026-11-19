import { expect, test } from '@playwright/test'
import { signIn, uniqueEmail, useOwnClientIp } from './support/sign-in'

// The browser's language is English, so the app is in English.
test.describe('Telling the user when the connection fails', () => {
  test('A request without a connection shows a connection message', async ({
    page,
    context,
  }) => {
    await useOwnClientIp(page)
    await page.goto('/sign-in')
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill(uniqueEmail('offline'))

    await context.setOffline(true)
    await page.getByRole('button', { name: 'Send code' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('No connection')
    await expect(alert).not.toContainText('Error reference')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Sign in to Kotivalo' }),
    ).toBeVisible()
  })

  test('A page that cannot load without a connection shows a connection message', async ({
    page,
    context,
  }) => {
    await signIn(page, uniqueEmail('offline'))
    await page.goto('/properties/new')
    await expect(
      page.getByRole('heading', { level: 1, name: 'New flat' }),
    ).toBeVisible()

    await context.setOffline(true)
    await page.getByRole('button', { name: 'Close' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('No connection')
    await expect(alert).not.toContainText('Error reference')
  })
})
