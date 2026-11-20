import { expect, test, type Page } from '@playwright/test'
import { card, kuusikuja } from './support/flats'
import { accepted, openSharing } from './support/sharing'
import { waitForHydration } from './support/sign-in'

// The browser's language is English, so the app is in English.

const history = (page: Page) =>
  page
    .getByRole('heading', { name: 'Ownership history' })
    .locator('xpath=following-sibling::*[1]')
    .getByRole('listitem')

/** On the Ownership and sharing page: an equal split from 1 March 2025. */
async function splitEqually(page: Page) {
  await page.getByRole('button', { name: 'Change ownership' }).click()
  await page.getByRole('button', { name: 'Equal shares' }).click()
  await page.getByRole('textbox', { name: 'From' }).fill('01/03/2025')
  await page.getByRole('button', { name: 'Save ownership change' }).click()
  await expect(history(page)).toHaveCount(2)
}

test.describe("Changing a flat's ownership", () => {
  test('An owner records a sale of half the flat', async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await openSharing(page, id)

    await splitEqually(page)

    await expect(history(page).nth(0)).toContainText('From 01/03/2025')
    await expect(history(page).nth(0)).toContainText('You 50% · Jussi 50%')
    await expect(history(page).nth(0)).toContainText('Sale · current')
    await expect(history(page).nth(1)).toContainText('You 100%')
    await jussi.close()
  })

  test("A change on the current period's start corrects its split", async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await openSharing(page, id)

    await page.getByRole('button', { name: 'Change ownership' }).click()
    await page.getByRole('button', { name: 'Equal shares' }).click()
    // The flat was added as owned since 12 June 2022.
    await page.getByRole('textbox', { name: 'From' }).fill('12/06/2022')
    await page.getByRole('button', { name: 'Save ownership change' }).click()

    await expect(history(page).nth(0)).toContainText('You 50% · Jussi 50%')
    await expect(history(page)).toHaveCount(1)
    await expect(history(page).nth(0)).toContainText('From 12/06/2022')
    await jussi.close()
  })

  test("A split that doesn't add up is refused", async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    await openSharing(page, id)

    await page.getByRole('button', { name: 'Change ownership' }).click()
    await page.getByRole('textbox', { name: 'Share (%), You' }).fill('60')
    await page.getByRole('textbox', { name: 'Share (%), Jussi' }).fill('30')
    await page.getByRole('textbox', { name: 'From' }).fill('01/03/2025')
    await page.getByRole('button', { name: 'Save ownership change' }).click()

    await expect(
      page.getByText('The shares add up to 90%. They must add up to 100%.'),
    ).toBeVisible()
    await expect(history(page)).toHaveCount(1)
    await jussi.close()
  })
})

test.describe('Roles follow the current shares', () => {
  test('A member who gets a share becomes an owner', async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await openSharing(page, id)
    await splitEqually(page)

    await openSharing(jussi, id)
    await expect(
      jussi.getByRole('button', { name: 'Change ownership' }),
    ).toBeVisible()
    await expect(jussi.getByRole('textbox', { name: 'Email' })).toBeVisible()
    await jussi.close()
  })
})

test.describe('Undoing the latest ownership change', () => {
  test('Undoing a change restores the previous split', async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await openSharing(page, id)
    await splitEqually(page)

    await page.getByRole('button', { name: 'Undo change' }).click()
    await page
      .getByRole('dialog', {
        name: 'Undo the ownership change from 01/03/2025?',
      })
      .getByRole('button', { name: 'Undo change' })
      .click()

    await expect(history(page)).toHaveCount(1)
    await expect(history(page).nth(0)).toContainText('You 100%')
    await jussi.close()
  })
})

test.describe('Correcting the first ownership date', () => {
  test('Correcting the date a flat was bought', async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    await openSharing(page, id)

    await page.getByRole('button', { name: 'Correct date' }).click()
    const dialog = page.getByRole('dialog', {
      name: 'Correct the ownership start date',
    })
    await dialog
      .getByRole('textbox', { name: 'Owned since' })
      .fill('01/01/2020')
    await dialog.getByRole('button', { name: 'Save' }).click()

    await expect(history(page).nth(0)).toContainText('From 01/01/2020')
    await jussi.close()
  })
})

test.describe("Showing a flat's ownership history", () => {
  test('A member sees the history', async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    await openSharing(page, id)
    await page.getByRole('button', { name: 'Change ownership' }).click()
    await page.getByRole('textbox', { name: 'From' }).fill('01/03/2025')
    await page.getByRole('combobox', { name: 'Reason' }).click()
    await page.getByRole('option', { name: 'Gift' }).click()
    await page.getByRole('button', { name: 'Save ownership change' }).click()
    await expect(history(page)).toHaveCount(2)

    await openSharing(jussi, id)

    await expect(history(jussi)).toHaveCount(2)
    await expect(history(jussi).nth(0)).toContainText('Gift · current')
    await expect(
      jussi.getByRole('button', { name: 'Change ownership' }),
    ).toHaveCount(0)
    await expect(
      jussi.getByRole('button', { name: 'Undo change' }),
    ).toHaveCount(0)
    await jussi.close()
  })
})

test.describe('Listing flats', () => {
  test('The card shows the owners and their shares', async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await openSharing(page, id)
    await splitEqually(page)

    await page.goto('/')
    await waitForHydration(page)
    await expect(card(page, kuusikuja.streetAddress)).toContainText(
      'You 50% · Jussi 50%',
    )
    await jussi.close()
  })
})
