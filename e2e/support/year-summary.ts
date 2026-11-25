// The year summary from Playwright. The year is always given in the URL,
// because the year the summary opens on depends on today's date. The app is
// in English (the browser's language).
import { expect, type Page } from '@playwright/test'
import { waitForHydration } from './sign-in'

export async function openYearSummary(page: Page, year: number) {
  await page.goto(`/year-summary?year=${String(year)}`)
  await expect(
    page.getByRole('heading', { level: 1, name: String(year) }),
  ).toBeVisible()
  await waitForHydration(page)
}

/** A flat's card on the year summary. */
export const summaryCard = (page: Page, streetAddress: string) =>
  page.getByRole('link').filter({ hasText: streetAddress })
