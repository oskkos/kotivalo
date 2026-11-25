import { expect, test, type Page } from '@playwright/test'
import {
  addFlat,
  fillInFlat,
  flatId,
  housingCompany,
  kuusikuja,
} from './support/flats'
import { accepted } from './support/sharing'
import { signIn, uniqueEmail, waitForHydration } from './support/sign-in'

// The browser's language is English, so the app is in English.

const FULL_LINE = 'As Oy Kuusikuja 3 · flat B 12 · Business ID 2345678-0'

/** The flat's address and housing company line sit in the header card. */
const header = (page: Page) =>
  page.getByRole('region', { name: 'Kuusikuja 3 B 12' })

async function openDetails(page: Page, id: string) {
  await page.goto(`/properties/${id}`)
  await expect(
    page.getByRole('heading', { name: 'Kuusikuja 3 B 12' }),
  ).toBeVisible()
}

async function openEdit(page: Page, id: string) {
  await page.goto(`/properties/${id}/edit`)
  await waitForHydration(page)
}

test.describe('Housing company details of a flat', () => {
  test('Adding a flat with its housing company details', async ({ page }) => {
    await signIn(page, uniqueEmail('taloyhtio'))
    await page.goto('/properties/new')
    await fillInFlat(page, { ...kuusikuja, ...housingCompany })
    await page.getByRole('button', { name: 'Save flat' }).click()
    await expect(page).toHaveURL(/\/$/)

    await openDetails(page, await flatId(page, 'Kuusikuja 3 B 12'))
    await expect(header(page)).toContainText(FULL_LINE)
  })

  test('A flat without housing company details', async ({ page }) => {
    await signIn(page, uniqueEmail('taloyhtio'))
    await addFlat(page, kuusikuja)

    await openDetails(page, await flatId(page, 'Kuusikuja 3 B 12'))
    await expect(header(page)).toContainText('33100 Tampere')
    await expect(header(page)).not.toContainText('Business ID')
    await expect(header(page)).not.toContainText('flat B')
  })

  test('Only the filled-in details are shown', async ({ page }) => {
    await signIn(page, uniqueEmail('taloyhtio'))
    await addFlat(page, {
      ...kuusikuja,
      housingCompanyName: 'As Oy Kuusikuja 3',
    })

    await openDetails(page, await flatId(page, 'Kuusikuja 3 B 12'))
    await expect(header(page)).toContainText('As Oy Kuusikuja 3')
    await expect(header(page)).not.toContainText('flat B')
    await expect(header(page)).not.toContainText('Business ID')
  })

  test('A Business ID with a wrong check digit is not saved', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail('taloyhtio'))
    await page.goto('/properties/new')
    await fillInFlat(page, { ...kuusikuja, businessId: '2345678-9' })
    await page.getByRole('button', { name: 'Save flat' }).click()

    await expect(
      page.getByRole('textbox', { name: 'Business ID' }),
    ).toHaveAccessibleDescription(
      'A Business ID looks like 1234567-8 (seven digits, a hyphen and a check digit).',
    )
    await expect(page).toHaveURL(/\/properties\/new$/)
  })

  test('A Business ID in the wrong form is not saved', async ({ page }) => {
    await signIn(page, uniqueEmail('taloyhtio'))
    await page.goto('/properties/new')
    for (const businessId of ['2345678', '23456780', '3141592-0']) {
      await fillInFlat(page, { ...kuusikuja, businessId })
      await page.getByRole('button', { name: 'Save flat' }).click()

      await expect(
        page.getByRole('textbox', { name: 'Business ID' }),
      ).toHaveAccessibleDescription(/^A Business ID looks like/)
      await expect(page).toHaveURL(/\/properties\/new$/)
    }
  })

  test('Spaces around the details are dropped', async ({ page }) => {
    await signIn(page, uniqueEmail('taloyhtio'))
    await addFlat(page, {
      ...kuusikuja,
      businessId: ' 2345678-0 ',
      apartmentNumber: '  B 12  ',
    })

    await openDetails(page, await flatId(page, 'Kuusikuja 3 B 12'))
    await expect(header(page)).toContainText(
      'flat B 12 · Business ID 2345678-0',
    )
  })

  test('Clearing the housing company details', async ({ page }) => {
    await signIn(page, uniqueEmail('taloyhtio'))
    await addFlat(page, { ...kuusikuja, ...housingCompany })
    const id = await flatId(page, 'Kuusikuja 3 B 12')

    await openEdit(page, id)
    for (const name of [
      'Housing company name',
      'Business ID',
      'Apartment number',
    ]) {
      await page.getByRole('textbox', { name }).clear()
    }
    await page.getByRole('button', { name: 'Save flat' }).click()

    await expect(page).toHaveURL(/\/properties\/[^/]+$/)
    await expect(header(page)).toContainText('33100 Tampere')
    await expect(header(page)).not.toContainText('As Oy Kuusikuja 3')
    await expect(header(page)).not.toContainText('Business ID')
  })

  test('A member can set the housing company details', async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)

    await openEdit(jussi, id)
    await jussi
      .getByRole('textbox', { name: 'Housing company name' })
      .fill('As Oy Kuusikuja 3')
    await jussi.getByRole('button', { name: 'Save flat' }).click()
    await expect(jussi).toHaveURL(/\/properties\/[^/]+$/)

    await openDetails(page, id)
    await expect(header(page)).toContainText('As Oy Kuusikuja 3')
    await jussi.close()
  })
})
