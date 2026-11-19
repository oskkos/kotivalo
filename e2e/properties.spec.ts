import { expect, test, type Page } from '@playwright/test'
import { signIn, uniqueEmail } from './support/sign-in'

// The browser's language is English, so the app is in English.

async function fillInFlat(
  page: Page,
  flat: {
    streetAddress: string
    postcode: string
    city: string
    rooms: string
    floorArea: string
  },
) {
  await page
    .getByRole('textbox', { name: 'Street address' })
    .fill(flat.streetAddress)
  await page.getByRole('textbox', { name: 'Postcode' }).fill(flat.postcode)
  await page.getByRole('textbox', { name: 'City' }).fill(flat.city)
  await page.getByRole('button', { name: flat.rooms }).click()
  await page
    .getByRole('textbox', { name: 'Floor area (m²)' })
    .fill(flat.floorArea)
}

const kuusikuja = {
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  rooms: '2 rooms',
  floorArea: '48,5',
}

test.describe('Adding a flat', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, uniqueEmail('asunto'))
    await page.goto('/properties/new')
  })

  test('An invalid postcode is not saved', async ({ page }) => {
    await fillInFlat(page, { ...kuusikuja, postcode: '3310' })
    await page.getByRole('button', { name: 'Save flat' }).click()

    await expect(
      page.getByRole('textbox', { name: 'Postcode' }),
    ).toHaveAccessibleDescription('A postcode has 5 digits.')
    await expect(page).toHaveURL(/\/properties\/new$/)
  })

  test('An invalid floor area is not saved', async ({ page }) => {
    for (const floorArea of ['0', '48,55']) {
      await fillInFlat(page, { ...kuusikuja, floorArea })
      await page.getByRole('button', { name: 'Save flat' }).click()

      await expect(
        page.getByRole('textbox', { name: 'Floor area (m²)' }),
      ).toHaveAccessibleDescription(
        'Enter the floor area in square metres, for example 48.5.',
      )
      await expect(page).toHaveURL(/\/properties\/new$/)
    }
  })
})

test.describe('Flat pages', () => {
  test('a flat that does not exist is not found', async ({ page }) => {
    await signIn(page, uniqueEmail('asunto'))
    await page.goto('/properties/00000000-0000-0000-0000-000000000000/edit')

    await expect(
      page.getByRole('heading', { name: 'Flat not found' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Back to flats' }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})
