import { expect, test, type Page } from '@playwright/test'
import { addFlat, card, flatId, kuusikuja } from './support/flats'
import {
  currentTenancyId,
  openRentMonth,
  recordPayment,
} from './support/rent-payments'
import {
  accepted,
  coOwned,
  invitationCard,
  invited,
  ownerWithFlat,
} from './support/sharing'
import { signIn, uniqueEmail, waitForHydration } from './support/sign-in'
import { addTenant, aino } from './support/tenancies'
import { logEntry, pdfReceipt } from './support/transactions'

// The browser's language is English, so the app is in English.

async function openDetails(page: Page, id: string) {
  await page.goto(`/properties/${id}`)
  await waitForHydration(page)
}

/** Opens the delete dialog from the details page's menu. */
async function openDelete(page: Page, id: string) {
  await openDetails(page, id)
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete flat' }).click()
  return page.getByRole('dialog', { name: 'Delete the flat?' })
}

/** A tenancy with a rent payment, and an expense with a receipt. */
async function withData(page: Page, id: string) {
  await addTenant(page, id, aino)
  const tenancyId = await currentTenancyId(page, id)
  await openRentMonth(page, id, tenancyId, '2025-03')
  await recordPayment(page, { paidOn: '05/03/2025' })
  await logEntry(page, id, {
    category: 'Annual repair',
    amount: '145,50',
    date: '12/03/2025',
    receipt: pdfReceipt(),
  })
}

/** Types the address and deletes for good; lands on the list. */
async function deletePermanently(page: Page, id: string) {
  const dialog = await openDelete(page, id)
  await dialog
    .getByRole('textbox', { name: 'Type the street address to confirm' })
    .fill('kuusikuja 3 b 12')
  await dialog.getByRole('button', { name: 'Delete permanently' }).click()
  await expect(page).toHaveURL(/\/$/)
}

const notFound = (page: Page) =>
  page.getByRole('heading', { name: 'Flat not found' })

test.describe('Deleting a flat', () => {
  test('Deleting removes the flat and its receipt files', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await withData(page, id)
    await page.getByRole('listitem').getByRole('link').click()
    const receipt = await page
      .getByRole('link', { name: 'Open the PDF receipt' })
      .getAttribute('href')
    expect(receipt).toMatch(/^\/api\/receipts\//)
    expect((await page.request.get(receipt ?? '')).status()).toBe(200)

    await deletePermanently(page, id)

    await expect(page.getByRole('status')).toHaveText(
      'Kuusikuja 3 B 12 deleted',
    )
    await expect(card(page, 'Kuusikuja 3 B 12')).toHaveCount(0)
    await openDetails(page, id)
    await expect(notFound(page)).toBeVisible()
    // The served URL is gone with the receipt's row. Whether the file left
    // storage too is checked in properties.server.test.ts, which reads R2.
    expect((await page.request.get(receipt ?? '')).status()).toBe(404)
  })

  test('The list is up to date when it was already open before deleting', async ({
    page,
  }) => {
    await ownerWithFlat(page)
    await addFlat(page, { ...kuusikuja, streetAddress: 'Mäntytie 9 A 2' })
    // Reached by clicking, so the router keeps the list it showed.
    await page.goto('/')
    await waitForHydration(page)
    await card(page, 'Kuusikuja 3 B 12').getByRole('link').click()
    await expect(page).toHaveURL(/\/properties\//)

    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete flat' }).click()
    await page
      .getByRole('dialog', { name: 'Delete the flat?' })
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(page).toHaveURL(/\/$/)

    await expect(page.getByText('1 flat')).toBeVisible()
    await expect(card(page, 'Kuusikuja 3 B 12')).toHaveCount(0)
    await expect(card(page, 'Mäntytie 9 A 2')).toBeVisible()
  })

  test('A member loses access when the flat is deleted', async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await logEntry(page, id, {
      category: 'Annual repair',
      amount: '145,50',
      date: '12/03/2025',
    })

    const dialog = await openDelete(page, id)
    await expect(dialog).toContainText(
      'This member loses access to the flat: Jussi',
    )
    await deletePermanently(page, id)

    await jussi.goto('/')
    await expect(card(jussi, 'Kuusikuja 3 B 12')).toHaveCount(0)
    await openDetails(jussi, id)
    await expect(notFound(jussi)).toBeVisible()
  })

  test('A pending invitation goes with the flat', async ({ page, browser }) => {
    const { id, jussi } = await invited(page, browser)
    await expect(invitationCard(jussi)).toContainText('Kuusikuja 3 B 12')

    await (
      await openDelete(page, id)
    )
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(page).toHaveURL(/\/$/)

    await jussi.reload()
    await waitForHydration(jussi)
    await expect(invitationCard(jussi)).toHaveCount(0)
  })

  test("A co-owned flat can't be deleted", async ({ page, browser }) => {
    const { id } = await coOwned(page, browser)

    const dialog = await openDelete(page, id)

    await expect(dialog).toContainText("The flat can't be deleted")
    await expect(dialog).toContainText('Other owners: Jussi')
    await expect(dialog.getByRole('button', { name: /^Delete/ })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Archive flat' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Archive the flat?' }),
    ).toBeVisible()
  })

  test('A member has no Delete flat in the menu', async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    await openDetails(jussi, id)
    await jussi.getByRole('button', { name: 'More actions' }).click()
    await expect(
      jussi.getByRole('menuitem', { name: 'Archive flat' }),
    ).toBeVisible()
    await expect(
      jussi.getByRole('menuitem', { name: 'Delete flat' }),
    ).toHaveCount(0)
  })
})

test.describe('Confirming the deletion of a flat', () => {
  test('An empty flat is deleted with a plain confirmation', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail('omistaja'), 'Annika')
    await addFlat(page, { ...kuusikuja, streetAddress: 'Mäntytie 9 A 2' })
    const id = await flatId(page, 'Mäntytie 9 A 2')

    const dialog = await openDelete(page, id)
    await expect(dialog).toContainText(
      "Mäntytie 9 A 2 will be deleted permanently. This can't be undone.",
    )
    await expect(dialog.getByRole('textbox')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('status')).toHaveText('Mäntytie 9 A 2 deleted')
    await expect(card(page, 'Mäntytie 9 A 2')).toHaveCount(0)
  })

  test('The confirmation lists what is removed', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await withData(page, id)

    const dialog = await openDelete(page, id)

    await expect(dialog).toContainText('1 tenancy')
    await expect(dialog).toContainText('1 rent payment')
    await expect(dialog).toContainText('1 entry')
    await expect(dialog).toContainText('1 receipt')
  })

  test('Deleting waits for the street address', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await logEntry(page, id, {
      category: 'Annual repair',
      amount: '145,50',
      date: '12/03/2025',
    })
    const dialog = await openDelete(page, id)
    const field = dialog.getByRole('textbox', {
      name: 'Type the street address to confirm',
    })
    const button = dialog.getByRole('button', { name: 'Delete permanently' })

    await field.fill('Kuusikuja 3 B')
    await expect(button).toBeDisabled()
    await field.fill('kuusikuja 3 b 12')
    await expect(button).toBeEnabled()
  })

  test('Cancelling keeps the flat', async ({ page }) => {
    const id = await ownerWithFlat(page)

    const dialog = await openDelete(page, id)
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(`/properties/${id}`)
    await page.goto('/')
    await expect(card(page, 'Kuusikuja 3 B 12')).toBeVisible()
  })
})
