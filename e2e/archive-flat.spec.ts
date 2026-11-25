import { expect, test, type Page } from '@playwright/test'
import { addFlat, card, flatId, kuusikuja } from './support/flats'
import { accepted, coOwned, ownerWithFlat } from './support/sharing'
import { waitForHydration } from './support/sign-in'
import { addTenant, aino } from './support/tenancies'
import { fillEntry } from './support/transactions'

// The browser's language is English, so the app is in English.

const today = new Date()
const dd = (n: number) => String(n).padStart(2, '0')
const todayText = `${dd(today.getDate())}/${dd(today.getMonth() + 1)}/${String(today.getFullYear())}`

const koivupolku = {
  ...kuusikuja,
  streetAddress: 'Koivupolku 7 A 4',
  postcode: '00100',
  city: 'Helsinki',
}

async function openDetails(page: Page, id: string) {
  await page.goto(`/properties/${id}`)
  await waitForHydration(page)
}

async function openMenu(page: Page) {
  await page.getByRole('button', { name: 'More actions' }).click()
  return page.getByRole('menu')
}

/** Archives the flat from its details page and lands on the list. */
async function archive(page: Page, id: string) {
  await openDetails(page, id)
  await (
    await openMenu(page)
  )
    .getByRole('menuitem', { name: 'Archive flat' })
    .click()
  await page
    .getByRole('dialog', { name: 'Archive the flat?' })
    .getByRole('button', { name: 'Archive' })
    .click()
  await expect(page).toHaveURL(/\/$/)
}

const flatsList = (page: Page) =>
  page.getByRole('main').getByRole('list').first()
const archivedToggle = (page: Page) =>
  page.getByRole('button', { name: /^Archived flats \(\d+\)$/ })

test.describe('Archiving a flat', () => {
  test("Archiving hides the flat from the user's list", async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addFlat(page, koivupolku)

    await archive(page, id)

    await expect(page.getByRole('status')).toHaveText(
      'Kuusikuja 3 B 12 archived',
    )
    await expect(page.getByText('1 flat')).toBeVisible()
    await expect(flatsList(page)).not.toContainText('Kuusikuja 3 B 12')
    await expect(flatsList(page)).toContainText('Koivupolku 7 A 4')
  })

  test('The list is up to date when it was already open before archiving', async ({
    page,
  }) => {
    await ownerWithFlat(page)
    await addFlat(page, koivupolku)
    // Reached by clicking, so the router keeps the list it showed.
    await page.goto('/')
    await waitForHydration(page)
    await card(page, 'Kuusikuja 3 B 12').getByRole('link').click()
    await expect(page).toHaveURL(/\/properties\//)

    await (
      await openMenu(page)
    )
      .getByRole('menuitem', { name: 'Archive flat' })
      .click()
    await page
      .getByRole('dialog', { name: 'Archive the flat?' })
      .getByRole('button', { name: 'Archive' })
      .click()
    await expect(page).toHaveURL(/\/$/)

    await expect(page.getByText('1 flat')).toBeVisible()
    await expect(flatsList(page)).not.toContainText('Kuusikuja 3 B 12')
    await expect(archivedToggle(page)).toBeVisible()
  })

  test('Cancelling keeps the flat on the list', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openDetails(page, id)
    await (
      await openMenu(page)
    )
      .getByRole('menuitem', { name: 'Archive flat' })
      .click()
    const dialog = page.getByRole('dialog', { name: 'Archive the flat?' })
    await expect(dialog).toContainText('Kuusikuja 3 B 12')

    await dialog.getByRole('button', { name: 'Cancel' }).click()

    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(`/properties/${id}`)
    await page.goto('/')
    await expect(card(page, 'Kuusikuja 3 B 12')).toBeVisible()
    await expect(archivedToggle(page)).toHaveCount(0)
  })

  test("Archiving doesn't change a co-owner's list", async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await coOwned(page, browser)
    await addTenant(page, id, aino)

    await archive(page, id)

    await jussi.goto('/')
    await expect(card(jussi, 'Kuusikuja 3 B 12')).toContainText(
      'You 50% · Annika 50%',
    )
    await expect(jussi.getByText('/ €890.00 received')).toBeVisible()
    await expect(archivedToggle(jussi)).toHaveCount(0)
  })

  test("An archived flat's own new entry form keeps the flat", async ({
    page,
  }) => {
    const id = await ownerWithFlat(page)
    await addFlat(page, koivupolku)
    await archive(page, id)
    await page.goto(`/properties/${id}/transactions`)
    await waitForHydration(page)

    await page.getByRole('link', { name: 'New entry' }).click()
    await waitForHydration(page)

    await expect(page.getByText('Kuusikuja 3 B 12')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Flat/ })).toHaveCount(0)
    await fillEntry(page, {
      category: 'Annual repair',
      amount: '145,50',
      date: todayText,
    })
    await page.getByRole('button', { name: 'Save expense' }).click()
    await expect(page).toHaveURL(
      new RegExp(`/properties/${id}/transactions\\?year=`),
    )
    await expect(page.getByRole('listitem')).toContainText('Annual repair')
  })

  test('A member can archive', async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)

    await archive(jussi, id)

    await expect(card(jussi, 'Kuusikuja 3 B 12')).toHaveCount(0)
    await openDetails(jussi, id)
    await expect(
      jussi.getByRole('heading', { name: 'Kuusikuja 3 B 12' }),
    ).toBeVisible()
    await page.goto('/')
    await expect(card(page, 'Kuusikuja 3 B 12')).toBeVisible()
  })
})

test.describe('Archived flats on the flats list', () => {
  test('The archived section opens to show the flat', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addFlat(page, koivupolku)
    await archive(page, id)

    const toggle = page.getByRole('button', { name: 'Archived flats (1)' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()

    await expect(card(page, 'Kuusikuja 3 B 12')).toContainText(
      `Archived ${todayText}`,
    )
  })

  test('An archived card opens the details page', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await archive(page, id)

    await archivedToggle(page).click()
    await card(page, 'Kuusikuja 3 B 12').getByRole('link').click()

    await expect(page).toHaveURL(`/properties/${id}`)
    await expect(
      page.getByRole('region', { name: `Archived ${todayText}` }),
    ).toBeVisible()
  })

  test('No section without archived flats', async ({ page }) => {
    await ownerWithFlat(page)

    await expect(card(page, 'Kuusikuja 3 B 12')).toBeVisible()
    await expect(archivedToggle(page)).toHaveCount(0)
  })
})

test.describe('Restoring an archived flat', () => {
  test('Restoring brings the flat back to the list', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await archive(page, id)
    await openDetails(page, id)
    const band = page.getByRole('region', { name: `Archived ${todayText}` })

    await band.getByRole('button', { name: 'Restore to your list' }).click()

    await expect(band).toBeHidden()
    await page.goto('/')
    await expect(card(page, 'Kuusikuja 3 B 12')).toBeVisible()
    await expect(archivedToggle(page)).toHaveCount(0)
  })

  test('Restoring from the menu', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await archive(page, id)
    await openDetails(page, id)

    await (
      await openMenu(page)
    )
      .getByRole('menuitem', { name: 'Restore to your list' })
      .click()

    await expect(
      page.getByRole('region', { name: `Archived ${todayText}` }),
    ).toBeHidden()
    await expect(
      (await openMenu(page)).getByRole('menuitem', { name: 'Archive flat' }),
    ).toBeVisible()
  })
})

test.describe('Listing flats', () => {
  test('An archived flat is left out of the list', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addFlat(page, koivupolku)
    await archive(page, id)

    await expect(page.getByText('1 flat')).toBeVisible()
    await expect(flatsList(page)).not.toContainText('Kuusikuja 3 B 12')
  })
})

test.describe('First run without flats', () => {
  test('A user whose flats are all archived', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await archive(page, id)

    await expect(
      page.getByRole('heading', { name: 'Add your first flat' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Add flat' }).first(),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Archived flats (1)' }),
    ).toBeVisible()
  })
})

test.describe('New entry from the bottom bar', () => {
  test('A user whose owned flats are all archived', async ({
    page,
    browser,
  }) => {
    const { jussi } = await accepted(page, browser)
    await addFlat(jussi, koivupolku)
    await archive(jussi, await flatId(jussi, koivupolku.streetAddress))
    await waitForHydration(jussi)

    await jussi
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'New entry' })
      .click()

    await expect(
      jussi.getByRole('heading', { name: 'Your flats are archived' }),
    ).toBeVisible()
    await expect(jussi.getByRole('textbox', { name: 'Amount' })).toHaveCount(0)
    await jussi.getByRole('link', { name: 'Back to flats' }).click()
    await expect(jussi).toHaveURL(/\/$/)
  })
})
