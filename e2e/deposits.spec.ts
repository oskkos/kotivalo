import { expect, test } from '@playwright/test'
import { accepted, ownerWithFlat } from './support/sharing'
import { waitForHydration } from './support/sign-in'
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
