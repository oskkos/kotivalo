// Usage charges from Playwright, through the app's own pages. The app is in
// English (the browser's language).
import { expect, type Page } from '@playwright/test'
import { waitForHydration } from './sign-in'

export interface UsageChargeInput {
  /** The kind's button, e.g. 'Water charge'. */
  kind: string
  /** The description for 'Other'. */
  description?: string
  /** The basis's button; the kind's default otherwise. */
  basis?: string
  /** As typed. */
  amount: string
  /** As typed (dd/mm/yyyy), the first of a month. */
  from: string
}

export async function openUsageCharges(page: Page, flatId: string) {
  await page.goto(`/properties/${flatId}/usage-charges`)
  await waitForHydration(page)
}

/** Adds a usage charge through its form and lands on the usage charges page. */
export async function addUsageCharge(
  page: Page,
  flatId: string,
  charge: UsageChargeInput,
) {
  await page.goto(`/properties/${flatId}/usage-charges/new`)
  await waitForHydration(page)
  await page.getByRole('button', { name: charge.kind, exact: true }).click()
  if (charge.description !== undefined) {
    await page
      .getByRole('textbox', { name: 'Description' })
      .fill(charge.description)
  }
  if (charge.basis !== undefined) {
    await page.getByRole('button', { name: charge.basis, exact: true }).click()
  }
  await page.getByRole('textbox', { name: /^Amount/ }).fill(charge.amount)
  await page.getByRole('textbox', { name: 'Valid from' }).fill(charge.from)
  await page.getByRole('button', { name: 'Add a usage charge' }).click()
  await expect(page).toHaveURL(/\/usage-charges$/)
}

/** Opens a usage charge's change form; `name` is its label. */
export async function openUsageCharge(page: Page, name: string) {
  await waitForHydration(page)
  await page
    .getByRole('link', { name: `Change the usage charge: ${name}` })
    .click()
  await waitForHydration(page)
}
