import { expect, test } from '@playwright/test'
import { accepted, ownerWithFlat } from './support/sharing'
import { signIn, uniqueEmail, waitForHydration } from './support/sign-in'
import { addTenant, aino, setOccupants } from './support/tenancies'
import { logEntry } from './support/transactions'
import {
  addUsageCharge,
  openUsageCharge,
  openUsageCharges,
} from './support/usage-charges'

// The browser's language is English, so the app is in English. The flat is
// owned since 2022 and Aino's tenancy runs from 1 March 2025.

const nextYear = String(new Date().getFullYear() + 1)
const list = (page: import('@playwright/test').Page) =>
  page.getByRole('list', { name: 'Usage charges' })

test.describe('The usage charges page', () => {
  test('The usage charges in effect today', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await setOccupants(page, '2', '01/03/2025')
    await addUsageCharge(page, id, {
      kind: 'Water charge',
      amount: '22',
      from: '01/01/2026',
    })
    await addUsageCharge(page, id, {
      kind: 'Parking space',
      amount: '15',
      from: '01/02/2026',
    })
    await expect(list(page)).toContainText('€44.00/month')
    await expect(list(page)).toContainText(
      '€22.00/occupant/month · 2 occupants',
    )
    await expect(list(page)).toContainText('From 01/02/2026')
    await expect(
      page.getByRole('link', { name: 'Add a usage charge' }),
    ).toBeVisible()
  })

  test('A flat without usage charges', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openUsageCharges(page, id)
    await expect(page.getByText('The flat has no usage charges.')).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Add a usage charge' }),
    ).toBeVisible()
  })

  test("A member sees the usage charges but can't change them", async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await addUsageCharge(page, id, {
      kind: 'Sauna',
      amount: '12',
      from: '01/01/2026',
    })
    await openUsageCharges(jussi, id)
    await expect(jussi.getByText('Sauna', { exact: true })).toBeVisible()
    await expect(
      jussi.getByRole('link', { name: 'Add a usage charge' }),
    ).toHaveCount(0)
    await expect(
      jussi.getByRole('link', { name: /Change the usage charge/ }),
    ).toHaveCount(0)
  })

  test("Another user can't open the usage charges page", async ({
    page,
    browser,
  }) => {
    const id = await ownerWithFlat(page)
    const other = await browser.newPage()
    await signIn(other, uniqueEmail('muu'), 'Matti')
    await other.goto(`/properties/${id}/usage-charges`)
    await expect(other.getByText(/not found/i).first()).toBeVisible()
  })
})

test.describe('Adding a usage charge', () => {
  test('Adding the water charge per occupant', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await setOccupants(page, '2', '01/03/2025')
    await page.goto(`/properties/${id}/usage-charges/new`)
    await waitForHydration(page)
    await page.getByRole('textbox', { name: /^Amount/ }).fill('22')
    await expect(
      page.getByText('Today €44.00/month (2 occupants)'),
    ).toBeVisible()
    await expect(
      page.getByText(
        /In the year summary: Maintenance charges and water charges/,
      ),
    ).toBeVisible()
    await page.getByRole('textbox', { name: 'Valid from' }).fill('01/01/2026')
    await page.getByRole('button', { name: 'Add a usage charge' }).click()
    await expect(page).toHaveURL(/\/usage-charges$/)
    await expect(list(page)).toContainText('Water charge')
    await expect(list(page)).toContainText('€44.00/month')
  })

  test('Other with a description', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addUsageCharge(page, id, {
      kind: 'Other',
      description: 'Laundry room',
      amount: '10',
      from: '01/01/2026',
    })
    await expect(list(page)).toContainText('Laundry room')
    await expect(list(page)).toContainText('€10.00/month')
  })
})

test.describe('Changing a usage charge', () => {
  test('Raising the water charge from next year', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addUsageCharge(page, id, {
      kind: 'Water charge',
      amount: '22',
      from: '01/01/2026',
    })
    await openUsageCharge(page, 'Water charge')
    await page.getByRole('textbox', { name: /^Amount/ }).fill('24')
    await page
      .getByRole('textbox', { name: 'Valid from' })
      .fill(`01/01/${nextYear}`)
    await page.getByRole('button', { name: 'Save change' }).click()
    await expect(page).toHaveURL(/\/usage-charges$/)
    await expect(list(page)).toContainText(
      `From 01/01/${nextYear}: €24.00/occupant/month`,
    )
  })

  test('Ending a parking space', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addUsageCharge(page, id, {
      kind: 'Parking space',
      amount: '15',
      from: '01/02/2026',
    })
    await openUsageCharge(page, 'Parking space')
    await page.getByRole('button', { name: 'Ending' }).click()
    await page
      .getByRole('textbox', { name: 'Valid from' })
      .fill(`01/03/${nextYear}`)
    await page.getByRole('button', { name: 'Save change' }).click()
    await expect(page).toHaveURL(/\/usage-charges$/)
    await expect(list(page)).toContainText(
      `From 01/03/${nextYear}: €0.00/month`,
    )
  })

  test('An ended usage charge is listed apart', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addUsageCharge(page, id, {
      kind: 'Sauna',
      amount: '12',
      from: '01/03/2025',
    })
    await openUsageCharge(page, 'Sauna')
    await page.getByRole('button', { name: 'Ending' }).click()
    await page.getByRole('textbox', { name: 'Valid from' }).fill('01/06/2026')
    await page.getByRole('button', { name: 'Save change' }).click()
    await expect(page).toHaveURL(/\/usage-charges$/)
    const ended = page.getByRole('region', { name: 'Ended usage charges' })
    await expect(ended).toContainText('Sauna')
    await expect(ended).toContainText('Ended 31/05/2026')
  })
})

test.describe('Undoing the latest usage charge change', () => {
  test('Undoing a usage charge increase', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addUsageCharge(page, id, {
      kind: 'Water charge',
      amount: '22',
      from: '01/01/2026',
    })
    await openUsageCharge(page, 'Water charge')
    await page.getByRole('textbox', { name: /^Amount/ }).fill('24')
    await page
      .getByRole('textbox', { name: 'Valid from' })
      .fill(`01/01/${nextYear}`)
    await page.getByRole('button', { name: 'Save change' }).click()
    await expect(page).toHaveURL(/\/usage-charges$/)
    await openUsageCharge(page, 'Water charge')
    await page.getByRole('button', { name: 'Undo the latest change' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('€22.00')
    await dialog.getByRole('button', { name: 'Undo change' }).click()
    await expect(page).toHaveURL(/\/usage-charges$/)
    await expect(list(page)).not.toContainText(`From 01/01/${nextYear}`)
  })

  test('Undoing the only amount removes the usage charge', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addUsageCharge(page, id, {
      kind: 'Sauna',
      amount: '12',
      from: '01/01/2026',
    })
    await openUsageCharge(page, 'Sauna')
    await page.getByRole('button', { name: 'Undo the latest change' }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Undo change' })
      .click()
    await expect(page).toHaveURL(/\/usage-charges$/)
    await expect(page.getByText('The flat has no usage charges.')).toBeVisible()
  })
})

test.describe('Water charge entries are warned about', () => {
  test('Water charge entries after the start are warned about', async ({
    page,
  }) => {
    const id = await ownerWithFlat(page)
    for (const date of ['20/01/2026', '20/02/2026']) {
      await logEntry(page, id, {
        type: 'Expense',
        category: 'Water charges to the housing company',
        amount: '44',
        date,
      })
    }
    await page.goto(`/properties/${id}/usage-charges/new`)
    await waitForHydration(page)
    await page.getByRole('textbox', { name: 'Valid from' }).fill('01/01/2026')
    await expect(
      page.getByText(
        'Water charge entries from 01/01/2026: 2, €88.00 in all.',
        {
          exact: false,
        },
      ),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Open the entries' }),
    ).toHaveAttribute('href', `/properties/${id}/transactions`)
  })
})

test.describe('The usage charges by month page', () => {
  test("The current year's usage charges by month", async ({ page }) => {
    const id = await ownerWithFlat(page)
    const year = new Date().getFullYear()
    await addUsageCharge(page, id, {
      kind: 'Parking space',
      amount: '15',
      from: `01/01/${String(year)}`,
    })
    await page.goto(`/properties/${id}/usage-charges/months`)
    await waitForHydration(page)
    const months = new Date().getMonth() + 1
    const total = page.getByRole('region', {
      name: `Usage charges in ${String(year)}`,
    })
    await expect(total).toContainText(`€${String(15 * months)}.00`)
    await expect(total).toContainText('Parking space')
    await expect(
      page.getByRole('list', { name: 'Months' }).getByRole('listitem'),
    ).toHaveCount(months)
  })

  test('A member sees the usage charges by month', async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await addUsageCharge(page, id, {
      kind: 'Sauna',
      amount: '12',
      from: '01/01/2026',
    })
    await jussi.goto(`/properties/${id}/usage-charges/months`)
    await expect(jussi.getByRole('list', { name: 'Months' })).toContainText(
      'Sauna',
    )
  })

  test('A flat without usage charges by month', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await page.goto(`/properties/${id}/usage-charges/months`)
    await waitForHydration(page)
    await page.getByRole('link', { name: 'Add usage charges' }).click()
    await expect(page).toHaveURL(/\/usage-charges$/)
  })
})
