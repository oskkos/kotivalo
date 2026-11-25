import { expect, test } from '@playwright/test'
import { addFlat, flatId, kuusikuja } from './support/flats'
import { accepted } from './support/sharing'
import { signIn, uniqueEmail, waitForHydration } from './support/sign-in'
import { logEntry } from './support/transactions'

// The browser's language is English, so the app is in English.

const nav = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: 'Main navigation' })

const koivupolku = {
  streetAddress: 'Koivupolku 7 A 4',
  postcode: '33100',
  city: 'Tampere',
  rooms: '1',
  floorArea: '31',
}

const rantatie = {
  streetAddress: 'Rantatie 15 C 21',
  postcode: '33100',
  city: 'Tampere',
  rooms: '2',
  floorArea: '52',
}

test.describe('The bottom navigation bar', () => {
  test('Moving between the flats list and the account page', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail('nav'), 'Annika')
    await waitForHydration(page)

    await nav(page).getByRole('link', { name: 'Account' }).click()
    await expect(page).toHaveURL('/account')
    await expect(
      nav(page).getByRole('link', { name: 'Account' }),
    ).toHaveAttribute('aria-current', 'page')

    await nav(page).getByRole('link', { name: 'Flats' }).click()
    await expect(page).toHaveURL('/')
    await expect(
      nav(page).getByRole('link', { name: 'Flats' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  test('The bottom bar opens a new entry', async ({ page }) => {
    await signIn(page, uniqueEmail('nav'), 'Annika')
    await waitForHydration(page)

    await nav(page).getByRole('link', { name: 'New entry' }).click()

    await expect(page).toHaveURL('/transactions/new')
  })

  test('The bottom bar opens the year summary', async ({ page }) => {
    await signIn(page, uniqueEmail('nav'), 'Annika')
    await waitForHydration(page)

    await nav(page).getByRole('link', { name: 'Taxes' }).click()

    await expect(page).toHaveURL(/\/year-summary(\?|$)/)
    await expect(
      nav(page).getByRole('link', { name: 'Taxes' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  test("Forms don't show the bottom bar", async ({ page }) => {
    await signIn(page, uniqueEmail('nav'), 'Annika')
    await page.goto('/properties/new')
    await waitForHydration(page)

    await expect(nav(page)).toHaveCount(0)
  })
})

test.describe('New entry from the bottom bar', () => {
  test('The only owned flat is chosen already', async ({ page }) => {
    await signIn(page, uniqueEmail('nav'), 'Annika')
    await addFlat(page, koivupolku)

    await nav(page).getByRole('link', { name: 'New entry' }).click()
    await waitForHydration(page)

    await expect(page.getByRole('button', { name: /^Flat/ })).toContainText(
      'Koivupolku 7 A 4',
    )
  })

  test('Choosing among owned flats', async ({ page, browser }) => {
    const { jussi } = await accepted(page, browser)
    await addFlat(jussi, koivupolku)
    await addFlat(jussi, rantatie)

    await nav(jussi).getByRole('link', { name: 'New entry' }).click()
    await waitForHydration(jussi)
    await jussi.getByRole('button', { name: /^Flat/ }).click()

    const choices = jussi.getByRole('radio')
    await expect(choices).toHaveCount(2)
    await expect(choices.nth(0)).toContainText('Koivupolku 7 A 4')
    await expect(choices.nth(1)).toContainText('Rantatie 15 C 21')
    await expect(
      jussi.getByRole('radio', { name: new RegExp(kuusikuja.streetAddress) }),
    ).toHaveCount(0)
  })

  test('A user without flats is asked to add one', async ({ page }) => {
    await signIn(page, uniqueEmail('nav'), 'Annika')
    await waitForHydration(page)
    await nav(page).getByRole('link', { name: 'New entry' }).click()

    await expect(
      page.getByRole('heading', { name: 'Add a flat first' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Add flat' }).click()

    await expect(page).toHaveURL('/properties/new')
  })

  test("A member of shared flats only can't add entries", async ({
    page,
    browser,
  }) => {
    const { jussi } = await accepted(page, browser)

    await nav(jussi).getByRole('link', { name: 'New entry' }).click()

    await expect(
      jussi.getByRole('heading', { name: 'Entries are added by the owners' }),
    ).toBeVisible()
    await expect(jussi.getByRole('textbox', { name: 'Amount' })).toHaveCount(0)
  })

  test('the flat last used on this device is chosen, without a hydration error', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text())
      }
    })
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })
    await signIn(page, uniqueEmail('nav'), 'Annika')
    await addFlat(page, koivupolku)
    await addFlat(page, rantatie)
    await logEntry(page, await flatId(page, rantatie.streetAddress), {
      category: 'Annual repair',
      amount: '20',
      // The flat's ownership begins today.
      date: new Date().toLocaleDateString('en-GB'),
    })

    // A full load renders the page on the server first.
    await page.goto('/transactions/new')
    await waitForHydration(page)

    await expect(page.getByRole('button', { name: /^Flat/ })).toContainText(
      'Rantatie 15 C 21',
    )
    // A production build reports a mismatch as React error #418, #423 or #425.
    expect(
      errors.filter((text) => /hydrat|#4(18|23|25)\b/i.test(text)),
    ).toEqual([])
  })
})
