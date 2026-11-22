// Rent payments from Playwright, through the app's own pages. The app is in
// English (the browser's language).
import { expect, type Page } from '@playwright/test'
import { waitForHydration } from './sign-in'

/** The current tenancy's id, read from the Tenancy page's edit link. */
export async function currentTenancyId(page: Page, flatId: string) {
  await page.goto(`/properties/${flatId}/tenancy`)
  const href = await page
    .getByRole('link', { name: 'Edit the tenancy' })
    .getAttribute('href')
  const id = /\/tenancy\/([^/]+)\/edit/.exec(href ?? '')?.[1]
  if (id === undefined) {
    throw new Error('no current tenancy')
  }
  return id
}

/** Opens a month's payments page, e.g. month `2026-01`. */
export async function openRentMonth(
  page: Page,
  flatId: string,
  tenancyId: string,
  month: string,
) {
  await page.goto(`/properties/${flatId}/rent/${tenancyId}/${month}`)
  await waitForHydration(page)
}

/** Records a payment from the open month page, through the dialog. */
export async function recordPayment(
  page: Page,
  payment: { amount?: string; paidOn?: string },
) {
  await page.getByRole('button', { name: 'Add payment' }).click()
  const dialog = page.getByRole('dialog')
  if (payment.amount !== undefined) {
    await dialog
      .getByRole('textbox', { name: 'Amount (€)' })
      .fill(payment.amount)
  }
  if (payment.paidOn !== undefined) {
    await dialog
      .getByRole('textbox', { name: 'Payment date' })
      .fill(payment.paidOn)
  }
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
}
