import { expect, test, type Page } from '@playwright/test'
import { ownerWithFlat } from './support/sharing'
import { waitForHydration } from './support/sign-in'

// The browser's language is English, so the app is in English.

const thisYear = new Date().getFullYear()

async function openEntries(page: Page, id: string) {
  await page.goto(`/properties/${id}/transactions`)
  await waitForHydration(page)
}

test.describe('The entries page', () => {
  test('Opening the page from the edit page', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await page.goto(`/properties/${id}/edit`)
    await waitForHydration(page)

    await page.getByRole('link', { name: 'Entries' }).click()

    await expect(page).toHaveURL(new RegExp(`/properties/${id}/transactions$`))
    await expect(
      page.getByRole('heading', { name: 'Entries', exact: true }),
    ).toBeVisible()
    await expect(page.getByText('Kuusikuja 3 B 12')).toBeVisible()
  })

  test('A flat without entries', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openEntries(page, id)

    await expect(
      page.getByRole('heading', {
        name: `No entries for ${String(thisYear)}`,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: String(thisYear) }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})
