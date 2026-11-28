import { expect, test, type Browser, type Page } from '@playwright/test'
import { openAmounts, setAmount } from './support/amounts'
import {
  addFlat,
  card,
  flatId,
  housingCompany,
  kuusikuja,
} from './support/flats'
import {
  currentTenancyId,
  openRentMonth,
  recordPayment,
} from './support/rent-payments'
import { accepted, coOwned, openSharing } from './support/sharing'
import { signIn, uniqueEmail, waitForHydration } from './support/sign-in'
import { addTenant } from './support/tenancies'
import {
  chooseHolder,
  holderButton,
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
    // He still sees the owner's figures and the whole flats.
    await holderButton(jussi).click()
    const sheet = jussi.getByRole('dialog')
    await expect(sheet.getByRole('radio', { name: /Annika/ })).toBeVisible()
    await expect(
      sheet.getByRole('radio', { name: /Whole flats/ }),
    ).toBeVisible()
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
      'Maintenance charge (hoitovastike) €2,400.00',
    )
    await expect(
      page.getByRole('heading', { name: 'Not on form 7H' }),
    ).toHaveCount(0)

    await page.getByRole('link', { name: 'Back to the year summary' }).click()
    await expect(page).toHaveURL('/year-summary?year=2025')
  })

  test('the page does not scroll sideways', async ({ page }) => {
    // Missing housing company details give a check, with its hidden heading.
    const id = await ownedIn2025(page, { housing: false })
    await openFlatYear(page, id, 2025)
    await expect(
      page.getByRole('heading', { name: 'Housing company details missing' }),
    ).toBeVisible()
    const width = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    expect(width.scroll).toBe(width.client)
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

  test("Another owner's form 7H page has the copy buttons", async ({
    page,
    browser,
  }) => {
    await coOwned(page, browser)
    await openYearSummary(page, 2025)
    await chooseHolder(page, /Jussi/)
    await summaryCard(page, kuusikuja.streetAddress).click()

    await expect(page.getByText('Form 7H · 2025 · Jussi')).toBeVisible()
    await expect(page.getByText('Share: Jussi')).toBeVisible()
    await expect(page.locator('[data-row="2.1"]')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Copy row 2.1' }),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Flat details' }),
    ).toBeVisible()
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

test.describe('Choosing whose figures', () => {
  test('Choosing whose figures', async ({ page, browser }) => {
    await coOwned(page, browser)
    await openYearSummary(page, 2026)
    await expect(holderButton(page)).toContainText('Your own share')

    await holderButton(page).click()
    const sheet = page.getByRole('dialog')
    await expect(
      sheet.getByRole('radio', { name: /Your own share/ }),
    ).toBeChecked()
    await expect(
      sheet.locator('label').filter({ hasText: 'Jussi' }),
    ).toContainText('1 flat')
    await sheet.getByRole('radio', { name: /Jussi/ }).click()
    await expect(page).toHaveURL(/\/year-summary\?year=2026&person=[^&]+$/)
    await expect(holderButton(page)).toContainText('Jussi')

    await page.getByRole('button', { name: 'Previous year' }).click()
    await expect(page).toHaveURL(/\/year-summary\?year=2025&person=[^&]+$/)
    await expect(holderButton(page)).toContainText('Jussi')

    await chooseHolder(page, /Your own share/)
    await expect(page).toHaveURL('/year-summary?year=2025')
  })

  test('The choice follows the year and the flat', async ({
    page,
    browser,
  }) => {
    await coOwned(page, browser)
    await openYearSummary(page, 2026)
    await chooseHolder(page, /Jussi/)
    await page.getByRole('button', { name: 'Previous year' }).click()
    await expect(page).toHaveURL(/\/year-summary\?year=2025&person=[^&]+$/)
    await expect(
      page.getByRole('heading', { level: 1, name: '2025' }),
    ).toBeVisible()
    const summaryUrl = page.url()

    await summaryCard(page, kuusikuja.streetAddress).click()
    await expect(page).toHaveURL(
      /\/year-summary\/[^?]+\?year=2025&person=[^&]+$/,
    )
    await page.getByRole('link', { name: 'Back to the year summary' }).click()
    await expect(page).toHaveURL(summaryUrl)
  })

  test('the selector stays in a year the chosen person had no share', async ({
    page,
    browser,
  }) => {
    // Jussi's share runs from 1 March 2025 to the end of 2025: Annika owns
    // the flat alone in 2026.
    const { id } = await coOwned(page, browser)
    await openSharing(page, id)
    await page.getByRole('button', { name: 'Change ownership' }).click()
    await page.getByRole('textbox', { name: 'Share (%), You' }).fill('100')
    await page.getByRole('textbox', { name: 'Share (%), Jussi' }).fill('0')
    await page.getByRole('textbox', { name: 'From' }).fill('01/01/2026')
    await page.getByRole('button', { name: 'Save ownership change' }).click()
    await expect(page.getByText('You 100%').first()).toBeVisible()

    await openYearSummary(page, 2025)
    await chooseHolder(page, /Jussi/)
    await page.getByRole('button', { name: 'Next year' }).click()
    await expect(
      page.getByRole('heading', { name: 'No ownership share in 2026' }),
    ).toBeVisible()
    await expect(holderButton(page)).toContainText('Jussi')

    await holderButton(page).click()
    await expect(
      page.getByRole('dialog').getByRole('radio', { name: /Jussi/ }),
    ).toBeChecked()
    await page
      .getByRole('dialog')
      .getByRole('radio', { name: /Your own share/ })
      .click()
    await expect(page).toHaveURL('/year-summary?year=2026')
    await expect(summaryCard(page, kuusikuja.streetAddress)).toBeVisible()
  })
})

test.describe("Another owner's figures", () => {
  test("Another owner's figures", async ({ page, browser }) => {
    await coOwned(page, browser)
    await openYearSummary(page, 2025)
    await chooseHolder(page, /Jussi/)

    await expect(page.getByText('Share: Jussi · 1 flat')).toBeVisible()
    await expect(page.getByText('Shared flats only')).toBeVisible()
    const card = summaryCard(page, kuusikuja.streetAddress)
    await expect(card).toContainText('Share 50%')
    await expect(card).toContainText('Share changed 01/03')
  })
})

test.describe('The whole flats', () => {
  test('The whole flats', async ({ page, browser }) => {
    await coOwned(page, browser)
    await openYearSummary(page, 2025)
    await chooseHolder(page, /Whole flats/)

    await expect(page).toHaveURL(/person=whole/)
    await expect(page.getByText('Whole flats · 1 flat')).toBeVisible()
    await expect(page.getByText(/are not reported as such/)).toBeVisible()
    const card = summaryCard(page, kuusikuja.streetAddress)
    await expect(card).toContainText('Annika 50% · Jussi 50%')
    await expect(card).not.toContainText('Share changed')
  })
})

test.describe("The whole flat's page", () => {
  test("The whole flat's page", async ({ page, browser }) => {
    await coOwned(page, browser)
    await openYearSummary(page, 2025)
    await chooseHolder(page, /Whole flats/)
    await summaryCard(page, kuusikuja.streetAddress).click()

    await expect(page).toHaveURL(
      /\/year-summary\/[^?]+\?year=2025&person=whole$/,
    )
    await expect(page.getByText('The whole flat, for checking')).toBeVisible()
    const owners = page.getByRole('region', { name: 'Owners' })
    await expect(owners.getByRole('link')).toHaveCount(2)
    await expect(owners).toContainText('Annika')
    await expect(owners).toContainText('Jussi')
    await expect(page.locator('[data-row="2.1"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Copy/ })).toHaveCount(0)
    await expect(
      page.getByRole('region', { name: 'Flat details' }),
    ).toHaveCount(0)

    await owners.getByRole('link', { name: /Jussi/ }).click()
    await expect(page).toHaveURL(/\?year=2025&person=(?!whole)[^&]+$/)
    await expect(page.getByText('Form 7H · 2025 · Jussi')).toBeVisible()

    await page.getByRole('link', { name: 'Back to the year summary' }).click()
    await expect(holderButton(page)).toContainText('Jussi')
  })
})

test.describe('Downloading the year summary as a PDF', () => {
  test("Downloading the own share's PDF", async ({ page }) => {
    await signIn(page, uniqueEmail('pdf'), 'Annika')
    await addFlat(page, { ...kuusikuja, ownedSince: '01/01/2024' })
    await openYearSummary(page, 2025)

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download PDF' }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe('kotivalo-year-summary-2025.pdf')
    const stream = await file.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer)
    }
    expect(Buffer.concat(chunks).subarray(0, 4).toString()).toBe('%PDF')
    await expect(
      page.getByText('Downloaded: kotivalo-year-summary-2025.pdf'),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Download PDF' }),
    ).toBeEnabled()
  })

  test('The PDF follows the chosen holder', async ({ page, browser }) => {
    await coOwned(page, browser)
    await openYearSummary(page, 2025)
    await chooseHolder(page, /Jussi/)

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download PDF' }).click()
    expect((await download).suggestedFilename()).toBe(
      'kotivalo-year-summary-2025-jussi.pdf',
    )
  })

  test('No PDF without flats in the summary', async ({ page, browser }) => {
    const { jussi } = await accepted(page, browser)
    await openYearSummary(jussi, 2025)
    await expect(
      jussi.getByRole('heading', { name: 'No ownership share in 2025' }),
    ).toBeVisible()
    await expect(
      jussi.getByRole('button', { name: 'Download PDF' }),
    ).toHaveCount(0)
  })
})

test.describe("A former owner's year summary", () => {
  /** Jussi's share ends on 31 December 2025 and his access is removed. */
  async function sold(page: Page, browser: Browser) {
    const { id, jussi } = await coOwned(page, browser)
    await openSharing(page, id)
    await page.getByRole('button', { name: 'Change ownership' }).click()
    await page.getByRole('textbox', { name: 'Share (%), You' }).fill('100')
    await page.getByRole('textbox', { name: 'Share (%), Jussi' }).fill('0')
    await page.getByRole('textbox', { name: 'From' }).fill('01/01/2026')
    await page
      .getByRole('checkbox', { name: 'Remove Jussi from the flat' })
      .check()
    await page.getByRole('button', { name: 'Save ownership change' }).click()
    await expect(page.getByText('You 100%').first()).toBeVisible()
    return { id, jussi }
  }

  test('A former owner sees their period', async ({ page, browser }) => {
    const { jussi } = await sold(page, browser)
    await openYearSummary(jussi, 2025)
    await expect(summaryCard(jussi, kuusikuja.streetAddress)).toContainText(
      'Your share 50%',
    )

    await jussi.goto('/')
    await waitForHydration(jussi)
    await expect(card(jussi, kuusikuja.streetAddress)).toHaveCount(0)
  })

  test('No flat pages for a former owner', async ({ page, browser }) => {
    const { id, jussi } = await sold(page, browser)
    await jussi.goto(`/properties/${id}`)
    await expect(
      jussi.getByRole('heading', { name: 'Flat not found' }),
    ).toBeVisible()
  })

  test("A former owner's read-only form 7H page", async ({ page, browser }) => {
    const { id, jussi } = await sold(page, browser)
    await openFlatYear(jussi, id, 2025)
    await expect(jussi.getByRole('note')).toContainText(
      'You no longer own the flat',
    )
    await expect(
      jussi.getByRole('heading', { level: 1, name: kuusikuja.streetAddress }),
    ).toBeVisible()
    await expect(jussi.getByRole('link', { name: /^Add/ })).toHaveCount(0)
    await expect(
      jussi.getByRole('button', { name: 'Copy: Ownership share' }),
    ).toBeVisible()
  })
})

/** The rental income after costs card of the year summary. */
const estimateCard = (page: Page) =>
  page.getByRole('region', { name: 'Rental income after costs' })

/** A flat with the 200 € charge for 2025 and 5 000 € of rent paid in it. */
async function earnedIn2025(page: Page) {
  const id = await ownedIn2025(page, { tenantFrom: '01/02/2025' })
  const tenancy = await currentTenancyId(page, id)
  await openRentMonth(page, id, tenancy, '2025-02')
  await recordPayment(page, { amount: '5000', paidOn: '03/02/2025' })
}

test.describe('Rental income after costs', () => {
  test('The rental income after costs of the year', async ({ page }) => {
    await earnedIn2025(page)
    await openYearSummary(page, 2025)
    const box = estimateCard(page)
    await expect(box).toContainText('Rental income (2.1)€5,000.00')
    await expect(box).toContainText('Costs (2.2–2.5)€2,400.00')
    await expect(box).toContainText('Result€2,600.00')
  })

  test('The rental income after costs of a flat', async ({ page }) => {
    const id = await ownedIn2025(page)
    await openFlatYear(page, id, 2025)
    const line = page.locator('[data-row="net"]')
    await expect(line).toContainText('Rental income after costs')
    await expect(line).toContainText('Not on form 7H')
    await expect(line).toContainText('-€2,400.00')
    await expect(line.getByRole('button')).toHaveCount(0)
  })
})

test.describe('The capital income tax estimate', () => {
  test('The estimate of the own share', async ({ page }) => {
    await earnedIn2025(page)
    await openYearSummary(page, 2025)
    // 30 % of 2 600 €.
    await expect(estimateCard(page)).toContainText('approx. €780')
    await expect(estimateCard(page)).toContainText('Tax Administration')
  })
})

test.describe('A rental loss in the estimate', () => {
  test('A loss in the year', async ({ page }) => {
    await ownedIn2025(page)
    await openYearSummary(page, 2025)
    const box = estimateCard(page)
    await expect(box).toContainText('Result-€2,400.00')
    await expect(box).toContainText('A loss for the year')
    await expect(box).not.toContainText('approx.')
  })
})

test.describe('Finnish originals of tax terms', () => {
  test('A row name in English', async ({ page }) => {
    const id = await ownedIn2025(page)
    await openFlatYear(page, id, 2025)
    await expect(
      page.locator('[data-row="2.1"]').getByRole('heading', {
        name: 'Gross rental income (bruttovuokratulot)',
      }),
    ).toBeVisible()
    await expect(page.locator('[data-row="2.2"]')).toContainText(
      'Maintenance charges and water charges (hoitovastikkeet ja vesimaksut)',
    )
  })
})
