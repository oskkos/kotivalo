import { expect, test } from '@playwright/test'
import { ownerWithFlat } from './support/sharing'
import { waitForHydration } from './support/sign-in'

// The browser's language is English, so the app is in English.

test.describe('tenancy page', () => {
  test('a new flat is vacant, and its card opens the page', async ({
    page,
  }) => {
    const id = await ownerWithFlat(page)
    await page.goto(`/properties/${id}/edit`)
    await waitForHydration(page)
    await page.getByRole('link', { name: /Tenancy.*Vacant/ }).click()
    await expect(page).toHaveURL(new RegExp(`/properties/${id}/tenancy$`))
    await expect(
      page.getByRole('heading', { name: 'The flat is vacant' }),
    ).toBeVisible()
    await expect(page.getByText(/The flat has no tenant yet\./)).toBeVisible()
  })
})
