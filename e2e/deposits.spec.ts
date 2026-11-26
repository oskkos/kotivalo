import { expect, test } from '@playwright/test'
import { accepted, ownerWithFlat } from './support/sharing'
import { waitForHydration } from './support/sign-in'
import {
  addEndedTenancy,
  endedTenancyId,
  openDepositReturn,
  recordDepositReturn,
} from './support/deposits'
import { openRentMonth } from './support/rent-payments'
import { addTenant, aino } from './support/tenancies'

// The browser's language is English, so the app is in English.

const depositCard = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Deposit', exact: true })

test.describe("A tenancy's deposit", () => {
  test('Adding a tenant with a deposit', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, { ...aino, rent: '890', deposit: '1780' })
    await expect(depositCard(page)).toContainText('€1,780.00')
  })

  test('A tenancy without a deposit', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await expect(depositCard(page)).toContainText('No deposit.')
  })

  test("A deposit over three months' rent is warned about", async ({
    page,
  }) => {
    const id = await ownerWithFlat(page)
    await page.goto(`/properties/${id}/tenancy/new`)
    await waitForHydration(page)
    await page.getByRole('textbox', { name: 'Monthly rent (€)' }).fill('890')
    await page.getByRole('textbox', { name: 'Deposit €' }).fill('3000')
    await expect(
      page.getByText(/at most three months' rent, which is €2,670.00/),
    ).toBeVisible()
    await addTenant(page, id, { ...aino, rent: '890', deposit: '3000' })
    await expect(depositCard(page)).toContainText('€3,000.00')
  })

  test('An invalid deposit is refused', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await page.goto(`/properties/${id}/tenancy/new`)
    await waitForHydration(page)
    await page.getByRole('textbox', { name: 'Name' }).fill('Aino Koski')
    await page.getByRole('textbox', { name: 'Starts' }).fill('01/03/2025')
    await page.getByRole('textbox', { name: 'Monthly rent (€)' }).fill('890')
    await page.getByRole('textbox', { name: 'Due day' }).fill('5')
    await page.getByRole('textbox', { name: 'Deposit €' }).fill('0')
    await page.getByRole('button', { name: 'Save tenant' }).click()
    await expect(page.getByText(/Enter the deposit in euros/)).toBeVisible()
    await expect(page).toHaveURL(/\/tenancy\/new$/)
  })

  test('Correcting the deposit', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, { ...aino, deposit: '1780' })
    await depositCard(page).getByRole('link', { name: 'Change' }).click()
    await waitForHydration(page)
    const deposit = page.getByRole('textbox', { name: 'Deposit €' })
    await expect(deposit).toHaveValue('1780.00')
    await deposit.fill('1700')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(new RegExp(`/properties/${id}/tenancy$`))
    await expect(depositCard(page)).toContainText('€1,700.00')
  })
})

test.describe('The deposit on the tenancy page', () => {
  test('The deposit card of the current tenancy', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, { ...aino, deposit: '1780' })
    await expect(depositCard(page)).toContainText('€1,780.00')
    await expect(
      depositCard(page).getByRole('link', { name: 'Change' }),
    ).toBeVisible()
  })

  test('Adding a deposit to a tenancy without one', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await depositCard(page).getByRole('link', { name: 'Add' }).click()
    await waitForHydration(page)
    await page.getByRole('textbox', { name: 'Deposit €' }).fill('1000')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(depositCard(page)).toContainText('€1,000.00')
  })

  test("A member sees the deposit but can't change it", async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await addTenant(page, id, { ...aino, deposit: '1780' })
    await jussi.goto(`/properties/${id}/tenancy`)
    await waitForHydration(jussi)
    const card = jussi.getByRole('region', { name: 'Deposit', exact: true })
    await expect(card).toContainText('€1,780.00')
    await expect(card.getByRole('link')).toHaveCount(0)
  })
})

test.describe('The deposit when ending a tenancy', () => {
  test('The end form shows the deposit', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, { ...aino, deposit: '1780' })
    await page.getByRole('link', { name: 'End tenancy' }).click()
    await waitForHydration(page)
    await expect(
      page.getByText(/The deposit is €1,780.00. It is returned after/),
    ).toBeVisible()
    await expect(
      page.getByText(/recorded later from the Tenancy page/),
    ).toBeVisible()
  })

  test('No deposit, no deposit section', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await page.getByRole('link', { name: 'End tenancy' }).click()
    await waitForHydration(page)
    await expect(page.getByText(/The deposit is/)).toHaveCount(0)
  })
})

const typed = (date: Date) =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear())}`

const reminder = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Deposit not returned' })

test.describe('Recording a deposit return', () => {
  test('Returning a deposit in full', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addEndedTenancy(page, id)
    await openDepositReturn(page)
    await expect(page.getByRole('status')).toContainText('€1,780.00')
    await recordDepositReturn(page)
    await expect(reminder(page)).toHaveCount(0)
    await expect(
      page.getByText(`Deposit returned ${typed(new Date())}: €1,780.00`),
    ).toBeVisible()
  })

  test('Returning with deductions', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addEndedTenancy(page, id)
    await openDepositReturn(page)
    await page.getByRole('button', { name: 'With deductions' }).click()
    await expect(page.getByText('March 2025 · €890.00')).toBeVisible()
    await page.getByRole('textbox', { name: 'Unpaid rent €' }).fill('300')
    await page
      .getByRole('textbox', { name: 'Damage and cleaning €' })
      .fill('200')
    await expect(page.getByRole('status')).toContainText('€1,280.00')
    await recordDepositReturn(page, {
      deductions: { rent: '300', damage: '200', note: 'Lattian korjaus' },
    })
    await expect(
      page.getByText(
        `Deposit returned ${typed(new Date())}: €1,280.00, €500.00 kept`,
      ),
    ).toBeVisible()
  })

  test('A return date in the future is refused', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addEndedTenancy(page, id)
    await openDepositReturn(page)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 2)
    await page
      .getByRole('textbox', { name: 'Return date' })
      .fill(typed(tomorrow))
    await page.getByRole('button', { name: 'Save the return' }).click()
    await expect(
      page.getByText("The return date can't be in the future."),
    ).toBeVisible()
  })

  test("A member can't record a return", async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    await addEndedTenancy(page, id)
    const tenancyId = await endedTenancyId(page, id)
    await jussi.goto(`/properties/${id}/tenancy/${tenancyId}/deposit`)
    await expect(jussi).toHaveURL(new RegExp(`/properties/${id}/tenancy$`))
  })
})

test.describe('Rent kept from the deposit', () => {
  test('The rent kept pays the missing month', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addEndedTenancy(page, id)
    const tenancyId = await endedTenancyId(page, id)
    await page.goto(`/properties/${id}/tenancy`)
    await openDepositReturn(page)
    await recordDepositReturn(page, { deductions: { rent: '300' } })
    await openRentMonth(page, id, tenancyId, '2025-03')
    await expect(page.getByText('From the deposit')).toBeVisible()
    await expect(page.getByText('€300.00').first()).toBeVisible()
    await expect(
      page.getByRole('button', { name: /^Delete the payment/ }),
    ).toHaveCount(0)
  })
})

test.describe('Correcting and deleting a deposit return', () => {
  test('Correcting the amount kept for damage', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addEndedTenancy(page, id)
    await openDepositReturn(page)
    await recordDepositReturn(page, {
      deductions: { rent: '300', damage: '200' },
    })
    const tenancyId = await endedTenancyId(page, id)
    await page.goto(`/properties/${id}/tenancy/${tenancyId}/deposit`)
    await waitForHydration(page)
    const damage = page.getByRole('textbox', { name: 'Damage and cleaning €' })
    await expect(damage).toHaveValue('200.00')
    await damage.fill('150')
    await expect(page.getByRole('status')).toContainText('€1,330.00')
    await page.getByRole('button', { name: 'Save the return' }).click()
    await expect(page).toHaveURL(/\/tenancy$/)
    await expect(
      page.getByText(
        `Deposit returned ${typed(new Date())}: €1,330.00, €450.00 kept`,
      ),
    ).toBeVisible()
  })

  test('Deleting a return removes its payments', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addEndedTenancy(page, id)
    await openDepositReturn(page)
    await recordDepositReturn(page, { deductions: { rent: '300' } })
    const tenancyId = await endedTenancyId(page, id)
    await page.goto(`/properties/${id}/tenancy/${tenancyId}/deposit`)
    await waitForHydration(page)
    await page.getByRole('button', { name: 'Delete the return' }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete the return' })
      .click()
    await expect(page).toHaveURL(/\/tenancy$/)
    await expect(reminder(page)).toBeVisible()
    await openRentMonth(page, id, tenancyId, '2025-03')
    await expect(page.getByText('From the deposit')).toHaveCount(0)
  })

  test('Opening the return from the correction form', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addEndedTenancy(page, id)
    await openDepositReturn(page)
    await recordDepositReturn(page, { deductions: { damage: '500' } })
    const tenancyId = await endedTenancyId(page, id)
    await page.goto(`/properties/${id}/tenancy/${tenancyId}/edit`)
    await waitForHydration(page)
    await expect(page.getByText(/Deposit returned/)).toBeVisible()
    await page.getByRole('link', { name: 'Deposit return' }).click()
    await waitForHydration(page)
    await expect(
      page.getByRole('textbox', { name: 'Damage and cleaning €' }),
    ).toHaveValue('500.00')
  })
})

test.describe('The deposit return reminder', () => {
  test('The reminder after the last rent day', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addEndedTenancy(page, id)
    await expect(reminder(page)).toContainText(
      'Aino Koski: the deposit of €1,780.00 is not returned',
    )
    await expect(reminder(page)).toContainText('by 14/01/2026')
    await expect(
      reminder(page).getByRole('link', { name: 'Record the return' }),
    ).toBeVisible()
  })

  test('No reminder before the last rent day', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, { ...aino, deposit: '1780' })
    await page.getByRole('link', { name: 'End tenancy' }).click()
    await waitForHydration(page)
    await page.getByRole('button', { name: 'End tenancy' }).click()
    await expect(page).toHaveURL(new RegExp(`/properties/${id}/tenancy$`))
    await expect(reminder(page)).toHaveCount(0)
  })

  test("A member sees the reminder but can't record", async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await addEndedTenancy(page, id)
    await jussi.goto(`/properties/${id}/tenancy`)
    await waitForHydration(jussi)
    await expect(
      jussi.getByRole('region', { name: 'Deposit not returned' }),
    ).toBeVisible()
    await expect(
      jussi.getByRole('link', { name: 'Record the return' }),
    ).toHaveCount(0)
  })
})
