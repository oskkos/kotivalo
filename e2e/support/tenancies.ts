// Tenancies from Playwright, through the app's own form. The app is in
// English (the browser's language).
import { expect, type Page } from '@playwright/test'
import { waitForHydration } from './sign-in'

export interface TenantDetails {
  name: string
  phone?: string
  email?: string
  /** Fixed-term when given, as typed. */
  termEnd?: string
  /** As typed (dd/mm/yyyy). */
  start: string
  /** As typed; the form's default (the start) otherwise. */
  contractMade?: string
  /** As typed; the suggested rent otherwise, or 890 € without one. */
  rent?: string
  dueDay?: string
  /** An earlier tenancy's ending, recorded in the same form. */
  ending?: {
    /** The way's button, e.g. 'Tenant'; the first way otherwise. */
    by?: string
    /** As typed. */
    noticeDate: string
    /** As typed; the suggested last day otherwise. */
    lastDay?: string
  }
}

/** Adds a tenant through the form and lands on the Tenancy page. */
export async function addTenant(
  page: Page,
  flatId: string,
  tenant: TenantDetails,
) {
  await page.goto(`/properties/${flatId}/tenancy/new`)
  await waitForHydration(page)
  await page.getByRole('textbox', { name: 'Name' }).fill(tenant.name)
  if (tenant.phone !== undefined) {
    await page.getByRole('textbox', { name: 'Phone' }).fill(tenant.phone)
  }
  if (tenant.email !== undefined) {
    await page.getByRole('textbox', { name: 'Email' }).fill(tenant.email)
  }
  if (tenant.termEnd !== undefined) {
    await page.getByRole('button', { name: 'Fixed-term' }).click()
  }
  await page.getByRole('textbox', { name: 'Starts' }).fill(tenant.start)
  if (tenant.termEnd !== undefined) {
    await page.getByRole('textbox', { name: 'Ends' }).fill(tenant.termEnd)
  }
  if (tenant.contractMade !== undefined) {
    await page
      .getByRole('textbox', { name: 'Contract made' })
      .fill(tenant.contractMade)
  }
  const rent = page.getByRole('textbox', { name: 'Monthly rent (€)' })
  if (tenant.rent !== undefined) {
    await rent.fill(tenant.rent)
  } else if ((await rent.inputValue()) === '') {
    // The rent is required: the previous tenancy's suggestion, or 890 €.
    await rent.fill('890')
  }
  await page
    .getByRole('textbox', { name: 'Due day' })
    .fill(tenant.dueDay ?? '5')
  if (tenant.ending) {
    const { by, noticeDate, lastDay } = tenant.ending
    await page
      .getByRole('checkbox', { name: /Notice has already been given/ })
      .check()
    if (by !== undefined) {
      await page.getByRole('button', { name: by, exact: true }).click()
    }
    await page.getByRole('textbox', { name: 'Notice date' }).fill(noticeDate)
    if (lastDay !== undefined) {
      await page
        .getByRole('textbox', { name: 'Last day of the tenancy' })
        .fill(lastDay)
    }
  }
  await page.getByRole('button', { name: 'Save tenant' }).click()
  await expect(page).toHaveURL(new RegExp(`/properties/${flatId}/tenancy$`))
}

export const aino: TenantDetails = {
  name: 'Aino Koski',
  phone: '040 123 4567',
  email: 'aino@example.com',
  contractMade: '12/02/2025',
  start: '01/03/2025',
  rent: '890',
}

/**
 * Changes the current tenancy's rent from the Tenancy page's rent card and
 * lands back on the page. Amount and date as typed.
 */
export async function changeRent(page: Page, amount: string, from: string) {
  await waitForHydration(page)
  await page
    .getByRole('region', { name: 'Rent' })
    .getByRole('link', { name: 'Change' })
    .click()
  await waitForHydration(page)
  await page.getByRole('textbox', { name: 'New amount (€/month)' }).fill(amount)
  await page.getByRole('textbox', { name: 'Valid from' }).fill(from)
  await page.getByRole('button', { name: 'Save change' }).click()
  await expect(page).toHaveURL(/\/tenancy$/)
}
