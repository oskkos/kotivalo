import { expect, test } from '@playwright/test'
import { addFlat, card, fillInFlat, flatId, kuusikuja } from './support/flats'
import { signIn, uniqueEmail, waitForHydration } from './support/sign-in'

// The browser's language is English, so the app is in English.

test.describe('Adding a flat', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, uniqueEmail('asunto'))
    await page.goto('/properties/new')
  })

  test('Adding a flat shows it in the list', async ({ page }) => {
    await fillInFlat(page, kuusikuja)
    await page.getByRole('button', { name: 'Save flat' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(card(page, 'Kuusikuja 3 B 12')).toContainText(
      'Tampere · 2 rooms 48.5 m²',
    )
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

test.describe('Editing a flat', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, uniqueEmail('muokkaus'))
    await addFlat(page, kuusikuja)
    await card(page, 'Kuusikuja 3 B 12').getByRole('link').click()
    await page.getByRole('link', { name: 'Edit flat' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Edit flat' }),
    ).toBeVisible()
  })

  test("Editing a flat's floor area", async ({ page }) => {
    await page.getByRole('textbox', { name: 'Floor area (m²)' }).fill('49')
    await page.getByRole('button', { name: 'Save flat' }).click()

    await expect(page).toHaveURL(/\/properties\/[^/]+$/)
    await expect(page.getByText('2 rooms · 49 m²')).toBeVisible()
  })

  test('The edit form shows the current details', async ({ page }) => {
    const field = (name: string) => page.getByRole('textbox', { name })
    await expect(field('Street address')).toHaveValue('Kuusikuja 3 B 12')
    await expect(field('Postcode')).toHaveValue('33100')
    await expect(field('City')).toHaveValue('Tampere')
    // English formats the area with a decimal point.
    await expect(field('Floor area (m²)')).toHaveValue('48.5')
    await expect(page.getByRole('button', { name: '2 rooms' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

test.describe('Listing flats', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, uniqueEmail('lista'))
    await addFlat(page, { ...kuusikuja, streetAddress: 'Rantatie 15 C 21' })
    await addFlat(page, { ...kuusikuja, streetAddress: 'Koivupolku 7 A 4' })
  })

  test('Flats are listed by street address', async ({ page }) => {
    await expect(page.getByText('2 flats')).toBeVisible()
    await expect(page.getByRole('listitem')).toHaveText([
      /^Koivupolku 7 A 4/,
      /^Rantatie 15 C 21/,
    ])
  })
})

test.describe('The flat details page', () => {
  test('Selecting a flat opens its details page', async ({ page }) => {
    await signIn(page, uniqueEmail('tiedot'))
    await addFlat(page, kuusikuja)
    await card(page, 'Kuusikuja 3 B 12').getByRole('link').click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Flat details' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Kuusikuja 3 B 12' }),
    ).toBeVisible()
    await expect(page.getByText('33100 Tampere')).toBeVisible()
    await expect(page.getByText('2 rooms · 48.5 m²')).toBeVisible()
  })
})

test.describe('First run without flats', () => {
  test('A new user sees how to add the first flat', async ({ page }) => {
    await signIn(page, uniqueEmail('ensimmainen'))

    await expect(
      page.getByRole('heading', { name: 'Add your first flat' }),
    ).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: 'Add flat' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'New flat' }),
    ).toBeVisible()
  })
})

test.describe('Flats are shown only to users with access', () => {
  test("Another user's flat is not listed", async ({ page, browser }) => {
    await signIn(page, uniqueEmail('anna'))
    await addFlat(page, kuusikuja)

    const other = await browser.newPage()
    await signIn(other, uniqueEmail('bertta'))
    await expect(
      other.getByRole('heading', { name: 'Add your first flat' }),
    ).toBeVisible()
    await expect(other.getByText('Kuusikuja 3 B 12')).toHaveCount(0)
    await other.close()
  })

  test("Another user's flat cannot be opened", async ({ page, browser }) => {
    await signIn(page, uniqueEmail('anna'))
    await addFlat(page, kuusikuja)
    const id = await flatId(page, 'Kuusikuja 3 B 12')

    const other = await browser.newPage()
    await signIn(other, uniqueEmail('bertta'))
    await other.goto(`/properties/${id}/edit`)
    await expect(
      other.getByRole('heading', { name: 'Flat not found' }),
    ).toBeVisible()
    await expect(other.getByRole('textbox')).toHaveCount(0)
    await other.close()
  })
})

test.describe('The first ownership period', () => {
  test('Adding a flat records its owner from the given date', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail('omistettu'))
    await page.goto('/properties/new')
    await waitForHydration(page)
    await fillInFlat(page, kuusikuja)
    const ownedSince = page.getByRole('textbox', { name: 'Owned since' })
    await ownedSince.fill('12/06/2022')
    await page.getByRole('button', { name: 'Save flat' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(card(page, kuusikuja.streetAddress)).toContainText('You 100%')
  })

  test('An ownership date in the future is refused', async ({ page }) => {
    await signIn(page, uniqueEmail('tulevaisuus'))
    await page.goto('/properties/new')
    await waitForHydration(page)
    await fillInFlat(page, kuusikuja)
    await page.getByRole('textbox', { name: 'Owned since' }).fill('31/12/2999')
    await page.getByRole('button', { name: 'Save flat' }).click()

    await expect(
      page.getByText("The date can't be in the future."),
    ).toBeVisible()
    await expect(page).toHaveURL('/properties/new')
  })
})
