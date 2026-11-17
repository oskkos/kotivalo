import { expect, test } from '@playwright/test'

test.describe('Home page', () => {
  test('shows the app name', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('heading', { level: 1, name: 'kotivalo' }),
    ).toBeVisible()
  })
})
