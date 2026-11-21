import { expect, test, type Page } from '@playwright/test'
import { accepted, ownerWithFlat } from './support/sharing'
import { waitForHydration } from './support/sign-in'

// The browser's language is English, so the app is in English.

async function openAmounts(page: Page, id: string) {
  await page.goto(`/properties/${id}/amounts`)
  await waitForHydration(page)
}

const section = (page: Page, name: string) => page.getByRole('region', { name })

test.describe('The rent and charges page', () => {
  test('A flat without amounts', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openAmounts(page, id)

    await expect(
      page.getByRole('heading', { name: 'Rent and charges' }),
    ).toBeVisible()
    for (const name of ['Rent', 'Maintenance charge', 'Financing charge']) {
      await expect(
        section(page, name).getByText('Not set').first(),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: `Set: ${name}` }),
      ).toBeVisible()
    }
    await expect(
      page.getByRole('button', {
        name: 'Set: Treatment by the housing company',
      }),
    ).toBeVisible()
  })

  test("A member sees the amounts but can't change them", async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await openAmounts(jussi, id)

    await expect(section(jussi, 'Rent').getByText('Not set')).toBeVisible()
    await expect(
      jussi.getByText('Only owners can change the amounts.'),
    ).toBeVisible()
    await expect(
      jussi.getByRole('button', { name: /^(Set|Change):/ }),
    ).toHaveCount(0)
    await jussi.close()
  })
})
