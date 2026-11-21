import { expect, test, type Page } from '@playwright/test'
import { ownerWithFlat } from './support/sharing'
import { waitForHydration } from './support/sign-in'
import {
  fillEntry,
  jpegPhoto,
  logEntry,
  pdfReceipt,
} from './support/transactions'

// The browser's language is English, so the app is in English.

const thisYear = new Date().getFullYear()
const lastYear = String(thisYear - 1)

async function openEntries(page: Page, id: string) {
  await page.goto(`/properties/${id}/transactions`)
  await waitForHydration(page)
}

test.describe('The entries page', () => {
  test('Entries are grouped by month, newest first', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await logEntry(page, id, {
      category: 'Annual repair',
      amount: '145,50',
      date: `12/11/${lastYear}`,
    })
    await logEntry(page, id, {
      type: 'Income',
      category: 'Water charges from the tenant',
      amount: '40',
      date: `03/11/${lastYear}`,
    })
    await logEntry(page, id, {
      category: 'Insurance',
      amount: '186',
      date: `28/10/${lastYear}`,
    })

    // Saving shows the year of the entry.
    await expect(page.getByRole('button', { name: lastYear })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const totals = page.getByRole('region', {
      name: "Totals of the year's entries",
    })
    await expect(totals).toContainText('+€40.00')
    await expect(totals).toContainText('-€331.50')
    const november = page
      .getByRole('region', { name: `November ${lastYear}` })
      .getByRole('listitem')
    await expect(november).toHaveCount(2)
    await expect(november.first()).toContainText('Annual repair')
    await expect(november.nth(1)).toContainText('Water charges from the tenant')
    await expect(
      page
        .getByRole('region', { name: `October ${lastYear}` })
        .getByRole('listitem'),
    ).toContainText('Insurance')
  })

  test('Opening the page from the edit page', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await page.goto(`/properties/${id}/edit`)
    await waitForHydration(page)

    await page.getByRole('link', { name: 'Entries' }).click()

    await expect(page).toHaveURL(new RegExp(`/properties/${id}/transactions$`))
    await expect(
      page.getByRole('heading', { name: 'Entries', exact: true }),
    ).toBeVisible()
    await expect(page.getByText('Kuusikuja 3 B 12')).toBeVisible()
  })

  test('A flat without entries', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openEntries(page, id)

    await expect(
      page.getByRole('heading', {
        name: `No entries for ${String(thisYear)}`,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: String(thisYear) }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('Logging an entry', () => {
  test('Logging an annual repair', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openEntries(page, id)
    await page.getByRole('link', { name: 'New entry' }).click()
    await waitForHydration(page)
    await expect(page.getByText('Kuusikuja 3 B 12')).toBeVisible()

    await fillEntry(page, {
      category: 'Annual repair',
      amount: '145,50',
      date: `12/11/${lastYear}`,
      note: 'Putkimies, keittiön hana',
    })
    await page.getByRole('button', { name: 'Save expense' }).click()

    const row = page
      .getByRole('region', { name: `November ${lastYear}` })
      .getByRole('listitem')
    await expect(row).toContainText('Annual repair')
    await expect(row).toContainText('Putkimies, keittiön hana')
    await expect(row).toContainText('-€145.50')
  })
})

test.describe('Entry categories', () => {
  test('The chosen category shows its tax hint', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await page.goto(`/transactions/new?propertyId=${id}`)
    await waitForHydration(page)

    await page
      .getByRole('button', { name: 'Annual repair', exact: true })
      .click()

    await expect(page.getByRole('status')).toContainText('Deductible expense')
    await expect(page.getByRole('status')).toContainText(
      'An improvement is not an annual repair.',
    )
  })
})

test.describe('Attaching a receipt', () => {
  test('Logging an expense with a receipt photo', async ({ page }) => {
    const id = await ownerWithFlat(page)
    const photo = await jpegPhoto(page, 4000, 3000)
    await logEntry(page, id, {
      category: 'Annual repair',
      amount: '145,50',
      date: `12/11/${lastYear}`,
      receipt: photo,
    })

    const row = page.getByRole('listitem').filter({ hasText: 'Annual repair' })
    await expect(
      row.getByRole('img', { name: 'Receipt attached' }),
    ).toBeVisible()
    await row.getByRole('link').click()
    const image = page
      .getByRole('button', {
        name: 'Open the receipt full screen',
      })
      .locator('img')
    const src = await image.getAttribute('src')
    const size = await page.evaluate(async (url) => {
      const blob = await (await fetch(url ?? '')).blob()
      const bitmap = await createImageBitmap(blob)
      return [bitmap.width, bitmap.height, blob.type]
    }, src)
    expect(size).toEqual([2000, 1500, 'image/jpeg'])
  })
})

test.describe('Entry details', () => {
  test('The details of an expense', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await logEntry(page, id, {
      category: 'Annual repair',
      amount: '145,50',
      date: `12/11/${lastYear}`,
      note: 'Putkimies, keittiön hana',
      receipt: pdfReceipt(),
    })
    await page.getByRole('listitem').getByRole('link').click()

    await expect(page.getByRole('heading', { name: 'Expense' })).toBeVisible()
    await expect(page.getByText('-€145.50')).toBeVisible()
    await expect(page.getByText('Deductible', { exact: true })).toBeVisible()
    await expect(page.getByText(`12/11/${lastYear}`)).toBeVisible()
    await expect(
      page.getByText(`${lastYear} · Expenses for annual repairs`),
    ).toBeVisible()
    await expect(page.getByText(/^You, /)).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Open the PDF receipt' }),
    ).toBeVisible()
  })
})

test.describe('Viewing and downloading a receipt', () => {
  test('Opening a receipt full screen', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await logEntry(page, id, {
      category: 'Annual repair',
      amount: '145,50',
      date: `12/11/${lastYear}`,
      receipt: await jpegPhoto(page, 800, 600),
    })
    await page.getByRole('listitem').getByRole('link').click()

    await page
      .getByRole('button', { name: 'Open the receipt full screen' })
      .click()

    const dialog = page.getByRole('dialog', { name: 'Receipt' })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('link', { name: 'Download the receipt' }),
    ).toHaveAttribute('href', /\/api\/receipts\/.+\?download=1$/)
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toBeHidden()
  })
})
