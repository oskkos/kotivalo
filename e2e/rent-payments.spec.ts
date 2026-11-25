import { expect, test } from '@playwright/test'
import {
  currentTenancyId,
  openRentMonth,
  recordPayment,
} from './support/rent-payments'
import { accepted, ownerWithFlat } from './support/sharing'
import { waitForHydration } from './support/sign-in'
import { addFee, addTenant, aino, setOccupants } from './support/tenancies'

// The browser's language is English, so the app is in English. The month
// used, January 2026, is inside Aino's tenancy and in the past.

test.describe('Recording a rent payment', () => {
  test('A second payment defaults to the missing amount', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    const tenancy = await currentTenancyId(page, id)
    await openRentMonth(page, id, tenancy, '2026-01')

    await recordPayment(page, { amount: '500', paidOn: '04/01/2026' })
    await expect(page.getByText('Partly paid')).toBeVisible()

    await page.getByRole('button', { name: 'Add payment' }).click()
    const dialog = page.getByRole('dialog', { name: 'January rent paid' })
    await expect(
      dialog.getByRole('textbox', { name: 'Amount (€)' }),
    ).toHaveValue('390.00')
    await dialog
      .getByRole('textbox', { name: 'Payment date' })
      .fill('20/01/2026')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Paid 20/01', { exact: true })).toBeVisible()
  })

  test('An invalid amount is refused', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    const tenancy = await currentTenancyId(page, id)
    await openRentMonth(page, id, tenancy, '2026-01')

    await page.getByRole('button', { name: 'Add payment' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: 'Amount (€)' }).fill('0')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(
      dialog.getByText(
        'Enter the amount in euros, for example 890 or 890.50. It must be between €0.01 and €100,000.',
      ),
    ).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('No payments recorded.')).toBeVisible()
  })
})

test.describe('Deleting a rent payment', () => {
  test('Deleting a wrongly recorded payment', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    const tenancy = await currentTenancyId(page, id)
    await openRentMonth(page, id, tenancy, '2026-01')
    await recordPayment(page, { paidOn: '03/01/2026' })

    await page
      .getByRole('button', {
        name: 'Delete the payment of €890.00, 03/01/2026',
      })
      .click()
    await page
      .getByRole('dialog', { name: 'Delete the payment?' })
      .getByRole('button', { name: 'Delete' })
      .click()

    await expect(page.getByText('No payments recorded.')).toBeVisible()
  })
})

test.describe("The month's rent payments page", () => {
  test('The breakdown of the rent and the fees', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await addFee(page, {
      kind: 'Water charge',
      amount: '22',
      from: '01/03/2025',
    })
    await addFee(page, {
      kind: 'Parking space',
      amount: '15',
      from: '01/03/2025',
    })
    await setOccupants(page, '2', '01/03/2025')
    const tenancy = await currentTenancyId(page, id)
    await openRentMonth(page, id, tenancy, '2026-01')
    await recordPayment(page, { amount: '500' })
    const summary = page.getByRole('region', { name: "The month's rent" })
    await expect(summary).toContainText('Rent€949.00')
    await expect(summary).toContainText('Outstanding€449.00')
    const breakdown = summary.getByRole('list', {
      name: 'Breakdown of the rent and fees',
    })
    await expect(breakdown).toContainText('Rent€890.00')
    await expect(breakdown).toContainText('Water charge · 2 × €22.00€44.00')
    await expect(breakdown).toContainText('Parking space€15.00')
  })

  test('The rent and the fees as one payment', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await addFee(page, {
      kind: 'Parking space',
      amount: '15',
      from: '01/03/2025',
    })
    const tenancy = await currentTenancyId(page, id)
    await openRentMonth(page, id, tenancy, '2026-01')
    await page.getByRole('button', { name: 'Add payment' }).click()
    const dialog = page.getByRole('dialog')
    await expect(
      dialog.getByRole('textbox', { name: 'Amount (€)' }),
    ).toHaveValue('905.00')
    await expect(dialog).toContainText(
      'The rent and the fees on top of the rent are recorded as one payment.',
    )
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Paid', { exact: true })).toBeVisible()
  })

  test("The month's payments", async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    await addTenant(page, id, aino)
    const tenancy = await currentTenancyId(page, id)
    await openRentMonth(page, id, tenancy, '2026-01')
    await recordPayment(page, { amount: '500', paidOn: '04/01/2026' })

    await jussi.goto(`/properties/${id}/rent/${tenancy}/2026-01`)
    await waitForHydration(jussi)
    await expect(
      jussi.getByRole('heading', { name: 'January rent' }),
    ).toBeVisible()
    await expect(jussi.getByText('Kuusikuja 3 B 12 · Aino Koski')).toBeVisible()
    await expect(jussi.getByText('Due 05/01/2026')).toBeVisible()
    await expect(jussi.getByText('Partly paid')).toBeVisible()
    const summary = jussi.getByRole('region', { name: "The month's rent" })
    await expect(summary).toContainText('€890.00')
    await expect(summary).toContainText('€500.00')
    await expect(summary).toContainText('€390.00')
    await expect(
      jussi.getByText('Paid 04/01/2026 · recorded by Annika'),
    ).toBeVisible()
  })

  test("A member sees the payments but can't change them", async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await addTenant(page, id, aino)
    const tenancy = await currentTenancyId(page, id)
    await openRentMonth(page, id, tenancy, '2026-01')
    await recordPayment(page, { paidOn: '03/01/2026' })

    await jussi.goto(`/properties/${id}/rent/${tenancy}/2026-01`)
    await waitForHydration(jussi)
    await expect(
      jussi.getByText('Paid 03/01/2026 · recorded by Annika'),
    ).toBeVisible()
    await expect(
      jussi.getByRole('button', { name: 'Add payment' }),
    ).toHaveCount(0)
    await expect(
      jussi.getByRole('button', { name: /Delete the payment/ }),
    ).toHaveCount(0)
  })
})

// Years relative to today, so the tests don't age: last year's October to
// December are in the past and among the months not fully paid.
const thisYear = new Date().getFullYear()
const lastYear = String(thisYear - 1)

test.describe('The rent payments page', () => {
  const fromOctober = {
    ...aino,
    contractMade: `01/09/${lastYear}`,
    start: `01/10/${lastYear}`,
  }

  test('Months newest first with their statuses', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, fromOctober)
    const tenancy = await currentTenancyId(page, id)
    await openRentMonth(page, id, tenancy, `${lastYear}-10`)
    await recordPayment(page, { paidOn: `03/10/${lastYear}` })
    await openRentMonth(page, id, tenancy, `${lastYear}-12`)
    await recordPayment(page, { amount: '500', paidOn: `04/12/${lastYear}` })

    await page.goto(`/properties/${id}/rent?year=${lastYear}`)
    await waitForHydration(page)
    const months = page
      .getByRole('list', { name: 'Months' })
      .getByRole('listitem')
    await expect(months).toHaveCount(3)
    await expect(months.nth(0)).toContainText('December')
    await expect(months.nth(0)).toContainText('Partly paid')
    await expect(months.nth(1)).toContainText('November')
    await expect(months.nth(1)).toContainText('Late')
    await expect(months.nth(2)).toContainText('October')
    await expect(months.nth(2)).toContainText('Paid')
    await expect(page.getByRole('note')).toContainText(
      `November ${lastYear}, December ${lastYear}`,
    )

    await months.nth(0).getByRole('link').click()
    await expect(
      page.getByRole('heading', { name: 'December rent' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Back to rent payments' }).click()
    await expect(page).toHaveURL(new RegExp(`/rent\\?year=${lastYear}$`))
    await expect(page.getByRole('button', { name: lastYear })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('Rent is received in the year it is paid', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, fromOctober)
    const tenancy = await currentTenancyId(page, id)
    await openRentMonth(page, id, tenancy, `${lastYear}-12`)
    await recordPayment(page, { paidOn: `02/01/${String(thisYear)}` })

    await page.goto(`/properties/${id}/rent?year=${String(thisYear)}`)
    await waitForHydration(page)
    await expect(
      page.getByRole('region', {
        name: `Rent received in ${String(thisYear)}`,
      }),
    ).toContainText('€890.00')

    await page.getByRole('button', { name: lastYear }).click()
    await expect(
      page.getByRole('region', { name: `Rent received in ${lastYear}` }),
    ).toContainText('€0.00')
  })

  test('Two tenancies in the same month', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, {
      name: 'Pekka Virtanen',
      contractMade: `01/12/${String(thisYear - 2)}`,
      start: `01/01/${lastYear}`,
      termEnd: `14/10/${lastYear}`,
      rent: '890',
    })
    await addTenant(page, id, { ...fromOctober, start: `15/10/${lastYear}` })

    await page.goto(`/properties/${id}/rent?year=${lastYear}`)
    await waitForHydration(page)
    const october = page
      .getByRole('list', { name: 'Months' })
      .getByRole('listitem')
      .filter({ hasText: 'October' })
    await expect(october).toHaveCount(2)
    await expect(october.nth(0)).toContainText('Aino Koski')
    await expect(october.nth(1)).toContainText('Pekka Virtanen')
  })

  test('A flat without tenancies', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await page.goto(`/properties/${id}/rent`)
    await waitForHydration(page)
    await expect(
      page.getByText('Rent payments are recorded once the flat has a tenant.'),
    ).toBeVisible()
  })
})
