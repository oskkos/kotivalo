import { expect, test } from '@playwright/test'
import { openAmounts, setAmount } from './support/amounts'
import { addFlat, flatId, kuusikuja } from './support/flats'
import { accepted } from './support/sharing'
import { signIn, uniqueEmail } from './support/sign-in'
import { openYearSummary, summaryCard } from './support/year-summary'

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
