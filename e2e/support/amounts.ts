// Rent and charges from Playwright, through the app's own forms. The app is
// in English (the browser's language).
import { expect, type Page } from '@playwright/test'
import { waitForHydration } from './sign-in'

export async function openAmounts(page: Page, id: string) {
  await page.goto(`/properties/${id}/amounts`)
  await waitForHydration(page)
}

/** On the Rent and charges page: sets or changes an amount via its form. */
export async function setAmount(
  page: Page,
  item: string,
  amount: string,
  from: string,
) {
  await page
    .getByRole('button', { name: new RegExp(`^(Set|Change): ${item}$`) })
    .click()
  await waitForHydration(page)
  await page.getByRole('textbox', { name: /amount/i }).fill(amount)
  await page.getByRole('textbox', { name: 'Valid from' }).fill(from)
  await page.getByRole('button', { name: /^Save/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Rent and charges' }),
  ).toBeVisible()
}

/** On the Rent and charges page: sets the treatment via its form. */
export async function setTreatment(
  page: Page,
  treatment: string,
  from: string,
) {
  await page
    .getByRole('button', {
      name: /^(Set|Change): Treatment by the housing company$/,
    })
    .click()
  await waitForHydration(page)
  await page.getByRole('button', { name: treatment }).click()
  await page.getByRole('textbox', { name: 'Valid from' }).fill(from)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(
    page.getByRole('heading', { name: 'Rent and charges' }),
  ).toBeVisible()
}
