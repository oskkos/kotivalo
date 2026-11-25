import { expect, test, type Page } from '@playwright/test'
import { openAmounts, setAmount } from './support/amounts'
import { addFlat, flatId, housingCompany, kuusikuja } from './support/flats'
import {
  currentTenancyId,
  openRentMonth,
  recordPayment,
} from './support/rent-payments'
import { accepted } from './support/sharing'
import { signIn, uniqueEmail } from './support/sign-in'
import { addTenant } from './support/tenancies'
import {
  openFlatYear,
  openYearSummary,
  summaryCard,
} from './support/year-summary'

// The browser's language is English, so the app is in English.

const rantatie = {
  ...kuusikuja,
  streetAddress: 'Rantatie 15 C 21',
  postcode: '00150',
  city: 'Helsinki',
}

test.describe('The year summary page', () => {
  test('The cards of the flats owned in the year', async ({ page }) => {
    await signIn(page, uniqueEmail('vuosi'), 'Annika')
    await addFlat(page, { ...kuusikuja, ownedSince: '01/01/2024' })
    await addFlat(page, { ...rantatie, ownedSince: '01/01/2024' })
    const id = await flatId(page, kuusikuja.streetAddress)
    await openAmounts(page, id)
    await setAmount(page, 'Maintenance charge', '200', '01/01/2025')

    await openYearSummary(page, 2025)
    const card = summaryCard(page, kuusikuja.streetAddress)
    await expect(card).toContainText('Your share 100%')
    await expect(card).toContainText('Rental income (2.1)€0.00')
    await expect(card).toContainText('Costs (2.2–2.5)€2,400.00')
    await expect(summaryCard(page, rantatie.streetAddress)).toBeVisible()

    await card.click()
    await expect(page).toHaveURL(`/year-summary/${id}?year=2025`)
  })

  test('A flat without a share is named, not summarised', async ({
    page,
    browser,
  }) => {
    const { jussi } = await accepted(page, browser)
    await addFlat(jussi, { ...rantatie, ownedSince: '01/01/2025' })

    await openYearSummary(jussi, 2025)
    await expect(summaryCard(jussi, rantatie.streetAddress)).toBeVisible()
    await expect(summaryCard(jussi, kuusikuja.streetAddress)).toHaveCount(0)
    await expect(
      jussi.getByText(
        'Not included: Kuusikuja 3 B 12, because you had no ownership share in it in 2025.',
      ),
    ).toBeVisible()
  })

  test('No share in any flat', async ({ page, browser }) => {
    const { jussi } = await accepted(page, browser)
    await openYearSummary(jussi, 2025)
    await expect(
      jussi.getByRole('heading', { name: 'No ownership share in 2025' }),
    ).toBeVisible()
    await expect(summaryCard(jussi, kuusikuja.streetAddress)).toHaveCount(0)
  })

  test('Moving to the previous year', async ({ page }) => {
    await signIn(page, uniqueEmail('edellinen'), 'Annika')
    await addFlat(page, { ...kuusikuja, ownedSince: '01/05/2024' })
    await openYearSummary(page, 2025)
    await page.getByRole('button', { name: 'Previous year' }).click()
    await expect(page).toHaveURL('/year-summary?year=2024')
    await expect(
      page.getByRole('heading', { level: 1, name: '2024' }),
    ).toBeVisible()
    await expect(summaryCard(page, kuusikuja.streetAddress)).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Previous year' }),
    ).toBeDisabled()
  })
})

/**
 * Annika's Kuusikuja, owned all of 2025 with a maintenance charge of 200 €
 * from January and, with `tenantFrom`, a tenant paying 890 € due on the 5th.
 */
async function ownedIn2025(
  page: Page,
  options: { housing?: boolean; tenantFrom?: string } = {},
) {
  await signIn(page, uniqueEmail('lomake'), 'Annika')
  await addFlat(page, {
    ...kuusikuja,
    ...(options.housing === false ? {} : housingCompany),
    ownedSince: '01/01/2025',
  })
  const id = await flatId(page, kuusikuja.streetAddress)
  await openAmounts(page, id)
  await setAmount(page, 'Maintenance charge', '200', '01/01/2025')
  if (options.tenantFrom !== undefined) {
    await addTenant(page, id, {
      name: 'Aino Koski',
      start: options.tenantFrom,
      rent: '890',
    })
  }
  return id
}

test.describe('The form 7H page of a flat', () => {
  test('The rows of a flat', async ({ page }) => {
    const id = await ownedIn2025(page, { tenantFrom: '01/02/2025' })
    const tenancy = await currentTenancyId(page, id)
    await openRentMonth(page, id, tenancy, '2025-02')
    await recordPayment(page, { amount: '890', paidOn: '03/02/2025' })

    await openFlatYear(page, id, 2025)
    await expect(
      page.getByRole('heading', { level: 1, name: kuusikuja.streetAddress }),
    ).toBeVisible()
    await expect(page.locator('[data-row="2.1"]')).toContainText('€890.00')
    await expect(page.locator('[data-row="2.2"]')).toContainText(
      'Maintenance charge €2,400.00',
    )
    await expect(
      page.getByRole('heading', { name: 'Not on form 7H' }),
    ).toHaveCount(0)

    await page.getByRole('link', { name: 'Back to the year summary' }).click()
    await expect(page).toHaveURL('/year-summary?year=2025')
  })

  test("A flat the user can't see", async ({ page, browser }) => {
    const id = await ownedIn2025(page)
    const other = await browser.newPage()
    await signIn(other, uniqueEmail('vieras'), 'Jussi')
    await other.goto(`/year-summary/${id}?year=2025`)
    await expect(
      other.getByRole('heading', { name: 'Flat not found' }),
    ).toBeVisible()
  })

  test('A flat without a share that year', async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    await openFlatYear(jussi, id, 2025)
    await expect(
      jussi.getByRole('heading', { name: 'No ownership share in 2025' }),
    ).toBeVisible()
    await expect(jussi.locator('[data-row]')).toHaveCount(0)
  })
})

test.describe('Flat details for form 7H', () => {
  test('Missing housing company details', async ({ page }) => {
    const id = await ownedIn2025(page, { housing: false })
    await openFlatYear(page, id, 2025)
    const details = page.getByRole('region', { name: 'Flat details' })
    for (const detail of [
      'Housing company name',
      'Business ID',
      'Apartment number',
    ]) {
      await expect(
        details.getByRole('link', { name: `Add: ${detail}` }),
      ).toBeVisible()
    }
    await details.getByRole('link', { name: 'Add: Business ID' }).click()
    await expect(page).toHaveURL(`/properties/${id}/edit`)
  })
})

test.describe('Checks in the year summary', () => {
  test('A month not paid', async ({ page }) => {
    const id = await ownedIn2025(page, { tenantFrom: '01/12/2025' })

    await openYearSummary(page, 2025)
    await expect(summaryCard(page, kuusikuja.streetAddress)).toContainText(
      'Rent not recorded for 1 month',
    )

    await openFlatYear(page, id, 2025)
    await expect(
      page.getByRole('heading', { name: 'Rent not recorded: December 2025' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Open rent payments' }).click()
    await expect(page).toHaveURL(`/properties/${id}/rent?year=2025`)
  })
})

test.describe('Copying form 7H values', () => {
  test('Copying an amount', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const id = await ownedIn2025(page)
    await openFlatYear(page, id, 2025)
    await page.getByRole('button', { name: 'Copy row 2.2' }).click()
    await expect(page.getByRole('status')).toHaveText('Copied: 2400,00')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      '2400,00',
    )
  })
})
