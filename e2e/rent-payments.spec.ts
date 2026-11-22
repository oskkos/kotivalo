import { expect, test } from '@playwright/test'
import {
  currentTenancyId,
  openRentMonth,
  recordPayment,
} from './support/rent-payments'
import { accepted, ownerWithFlat } from './support/sharing'
import { waitForHydration } from './support/sign-in'
import { addTenant, aino } from './support/tenancies'

// The browser's language is English, so the app is in English. The month
// used, January 2026, is inside Aino's tenancy and in the past.

test.describe('Recording a rent payment', () => {
  test('A second payment defaults to the missing amount', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    const tenancy = await currentTenancyId(page, id)
    await openRentMonth(page, id, tenancy, '2026-01')

    await recordPayment(page, { amount: '500', paidOn: '04/01/2026' })
    await expect(page.getByText('Partly paid')).toBeVisible()

    await page.getByRole('button', { name: 'Add payment' }).click()
    const dialog = page.getByRole('dialog', { name: 'January rent paid' })
    await expect(
      dialog.getByRole('textbox', { name: 'Amount (€)' }),
    ).toHaveValue('390.00')
    await dialog
      .getByRole('textbox', { name: 'Payment date' })
      .fill('20/01/2026')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Paid 20/01', { exact: true })).toBeVisible()
  })

  test('An invalid amount is refused', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    const tenancy = await currentTenancyId(page, id)
    await openRentMonth(page, id, tenancy, '2026-01')

    await page.getByRole('button', { name: 'Add payment' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: 'Amount (€)' }).fill('0')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(
      dialog.getByText(
        'Enter the amount in euros, for example 890 or 890.50. It must be between €0.01 and €100,000.',
      ),
    ).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('No payments recorded.')).toBeVisible()
  })
})

test.describe('Deleting a rent payment', () => {
  test('Deleting a wrongly recorded payment', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    const tenancy = await currentTenancyId(page, id)
    await openRentMonth(page, id, tenancy, '2026-01')
    await recordPayment(page, { paidOn: '03/01/2026' })

    await page
      .getByRole('button', {
        name: 'Delete the payment of €890.00, 03/01/2026',
      })
      .click()
    await page
      .getByRole('dialog', { name: 'Delete the payment?' })
      .getByRole('button', { name: 'Delete' })
      .click()

    await expect(page.getByText('No payments recorded.')).toBeVisible()
  })
})

test.describe("The month's rent payments page", () => {
  test("The month's payments", async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    await addTenant(page, id, aino)
    const tenancy = await currentTenancyId(page, id)
    await openRentMonth(page, id, tenancy, '2026-01')
    await recordPayment(page, { amount: '500', paidOn: '04/01/2026' })

    await jussi.goto(`/properties/${id}/rent/${tenancy}/2026-01`)
    await waitForHydration(jussi)
    await expect(
      jussi.getByRole('heading', { name: 'January rent' }),
    ).toBeVisible()
    await expect(jussi.getByText('Kuusikuja 3 B 12 · Aino Koski')).toBeVisible()
    await expect(jussi.getByText('Due 05/01/2026')).toBeVisible()
    await expect(jussi.getByText('Partly paid')).toBeVisible()
    const summary = jussi.getByRole('region', { name: "The month's rent" })
    await expect(summary).toContainText('€890.00')
    await expect(summary).toContainText('€500.00')
    await expect(summary).toContainText('€390.00')
    await expect(
      jussi.getByText('Paid 04/01/2026 · recorded by Annika'),
    ).toBeVisible()
  })

  test("A member sees the payments but can't change them", async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await addTenant(page, id, aino)
    const tenancy = await currentTenancyId(page, id)
    await openRentMonth(page, id, tenancy, '2026-01')
    await recordPayment(page, { paidOn: '03/01/2026' })

    await jussi.goto(`/properties/${id}/rent/${tenancy}/2026-01`)
    await waitForHydration(jussi)
    await expect(
      jussi.getByText('Paid 03/01/2026 · recorded by Annika'),
    ).toBeVisible()
    await expect(
      jussi.getByRole('button', { name: 'Add payment' }),
    ).toHaveCount(0)
    await expect(
      jussi.getByRole('button', { name: /Delete the payment/ }),
    ).toHaveCount(0)
  })
})
