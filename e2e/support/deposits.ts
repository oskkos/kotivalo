// Deposit returns from Playwright, through the app's own forms. The app is in
// English (the browser's language).
import { expect, type Page } from '@playwright/test'
import { waitForHydration } from './sign-in'
import { addTenant, aino } from './tenancies'

/**
 * Adds `Aino Koski` as an earlier tenancy with a deposit of 1 780 €: from
 * `01/03/2025`, rent 890 €, ended on `31/12/2025`. Lands on the Tenancy page,
 * which shows the deposit return reminder.
 */
export async function addEndedTenancy(page: Page, flatId: string) {
  await addTenant(page, flatId, {
    ...aino,
    rent: '890',
    deposit: '1780',
    ending: { by: 'Tenant', noticeDate: '01/11/2025', lastDay: '31/12/2025' },
  })
}

/** The id of the tenancy in the other tenancies list, from its row's link. */
export async function endedTenancyId(page: Page, flatId: string) {
  await page.goto(`/properties/${flatId}/tenancy`)
  const href = await page
    .getByRole('region', { name: 'Other tenancies' })
    .getByRole('link')
    .first()
    .getAttribute('href')
  const id = /\/tenancy\/([^/]+)\/edit/.exec(href ?? '')?.[1]
  if (id === undefined) {
    throw new Error('no ended tenancy')
  }
  return id
}

/** Opens the return page from the reminder card. */
export async function openDepositReturn(page: Page) {
  await page.getByRole('link', { name: 'Record the return' }).click()
  await waitForHydration(page)
}

/**
 * Fills in and saves the return page and lands on the Tenancy page. Without
 * `deductions` the deposit is returned in full.
 */
export async function recordDepositReturn(
  page: Page,
  options: {
    /** As typed; today otherwise. */
    date?: string
    deductions?: { rent?: string; damage?: string; note?: string }
  } = {},
) {
  if (options.date !== undefined) {
    await page.getByRole('textbox', { name: 'Return date' }).fill(options.date)
  }
  const { deductions } = options
  if (deductions) {
    await page.getByRole('button', { name: 'With deductions' }).click()
    if (deductions.rent !== undefined) {
      await page
        .getByRole('textbox', { name: 'Unpaid rent €' })
        .fill(deductions.rent)
    }
    if (deductions.damage !== undefined) {
      await page
        .getByRole('textbox', { name: 'Damage and cleaning €' })
        .fill(deductions.damage)
    }
    if (deductions.note !== undefined) {
      await page
        .getByRole('textbox', { name: 'Note (optional)' })
        .fill(deductions.note)
    }
  }
  await page.getByRole('button', { name: 'Save the return' }).click()
  await expect(page).toHaveURL(/\/tenancy$/)
}
