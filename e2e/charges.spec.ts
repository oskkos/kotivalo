import { expect, test, type Page } from '@playwright/test'
import {
  addFinancingCharge,
  openAmounts,
  setAmount,
  setTreatment,
} from './support/amounts'
import { accepted, ownerWithFlat } from './support/sharing'
import { signIn, uniqueEmail, waitForHydration } from './support/sign-in'

// The browser's language is English, so the app is in English. The amounts
// start from last year and this year, so the tests don't age.
const now = new Date()
const thisYear = now.getFullYear()
const lastYear = thisYear - 1
/** Months of this year so far, the current one included. */
const monthsSoFar = now.getMonth() + 1

const money = (cents: number): string =>
  new Intl.NumberFormat('en-FI', { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  )
const monthName = (index: number) =>
  new Intl.DateTimeFormat('en-FI', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, index, 1)),
  )

/** The estimate for the whole year, or in December the year's total. */
const estimateText =
  monthsSoFar < 12 ? `The whole year comes to ${money(360000)}` : money(360000)

const summary = (page: Page, year: number) =>
  page.getByRole('region', { name: `Charges in ${String(year)}` })
const months = (page: Page) =>
  page.getByRole('list', { name: 'Months' }).getByRole('listitem')

/**
 * Annika's flat: the maintenance charge 205 € from March last year and
 * 214 € from January, the financing charge Putkiremontti 86 € from March
 * last year, placed in reserve.
 */
async function flatWithCharges(page: Page) {
  const id = await ownerWithFlat(page)
  await openAmounts(page, id)
  const march = `01/03/${String(lastYear)}`
  await setAmount(page, 'Maintenance charge', '205', march)
  await setAmount(
    page,
    'Maintenance charge',
    '214',
    `01/01/${String(thisYear)}`,
  )
  await addFinancingCharge(page, 'Putkiremontti', '86', march)
  await setTreatment(page, 'Placed in reserve', march)
  return id
}

async function openCharges(page: Page, id: string) {
  await page.goto(`/properties/${id}/charges`)
  await waitForHydration(page)
}

test.describe('The charges page', () => {
  test("The current year's charges by month", async ({ page }) => {
    const id = await flatWithCharges(page)
    await openCharges(page, id)

    const year = summary(page, thisYear)
    await expect(year).toContainText(money(monthsSoFar * 30000))
    await expect(year).toContainText(
      `Maintenance charge${money(monthsSoFar * 21400)}`,
    )
    await expect(year).toContainText(
      `PutkiremonttiFinancing charge · Placed in reserve${money(monthsSoFar * 8600)}`,
    )
    await expect(year).toContainText(estimateText)
    await expect(months(page)).toHaveCount(monthsSoFar)
    await expect(months(page).first()).toContainText(monthName(monthsSoFar - 1))
    await expect(months(page).last()).toContainText(
      `Maintenance charge changed, was ${money(20500)}`,
    )
    await expect(months(page).last()).toContainText(money(30000))
  })

  test('Choosing an earlier year', async ({ page }) => {
    const id = await flatWithCharges(page)
    await openCharges(page, id)
    await page.getByRole('button', { name: String(lastYear) }).click()

    const year = summary(page, lastYear)
    await expect(year).toContainText(money(291000))
    await expect(year).not.toContainText('whole year')
    await expect(months(page)).toHaveCount(10)
    await expect(months(page).first()).toContainText('December')
    await expect(months(page).last()).toContainText('March')
    await expect(page).toHaveURL(new RegExp(`year=${String(lastYear)}`))
  })

  test('A member sees the charges', async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    await openAmounts(page, id)
    await setAmount(
      page,
      'Maintenance charge',
      '214',
      `01/01/${String(thisYear)}`,
    )

    await openCharges(jussi, id)
    await expect(summary(jussi, thisYear)).toContainText(
      money(monthsSoFar * 21400),
    )
    await expect(months(jussi)).toHaveCount(monthsSoFar)
    await jussi.close()
  })

  test('A flat without charges', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openCharges(page, id)

    await expect(page.getByText('No charges set')).toBeVisible()
    await page.getByRole('link', { name: 'Set charges' }).click()
    await expect(
      page.getByRole('heading', { name: 'Charges', exact: true }),
    ).toBeVisible()
  })

  test('A member of a flat without charges', async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    await openCharges(jussi, id)

    await expect(jussi.getByText('No charges set')).toBeVisible()
    await expect(jussi.getByRole('link', { name: 'Set charges' })).toHaveCount(
      0,
    )
    await jussi.close()
  })

  test("Another user can't open the charges page", async ({
    page,
    browser,
  }) => {
    const id = await ownerWithFlat(page)
    const other = await browser.newPage()
    await signIn(other, uniqueEmail('muu'), 'Liisa')
    await other.goto(`/properties/${id}/charges`)
    await expect(
      other.getByRole('heading', { name: 'Flat not found' }),
    ).toBeVisible()
    await other.close()
  })

  test('A line for each financing charge', async ({ page }) => {
    const id = await flatWithCharges(page)
    await addFinancingCharge(
      page,
      'Julkisivu',
      '42',
      `01/01/${String(thisYear)}`,
    )
    await openCharges(page, id)

    const year = summary(page, thisYear)
    await expect(year).toContainText(money(monthsSoFar * 34200))
    await expect(year).toContainText(
      `JulkisivuFinancing charge · Placed in reserve${money(monthsSoFar * 4200)}`,
    )
    await expect(months(page).first()).toContainText(
      `Maintenance charge ${money(21400)} · Putkiremontti ${money(8600)} · Julkisivu ${money(4200)}`,
    )
    await expect(months(page).last()).toContainText('Julkisivu started')
  })
})
