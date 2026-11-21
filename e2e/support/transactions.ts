// Entries from Playwright, through the app's own form. The app is in English
// (the browser's language): dates are dd/mm/yyyy.
import { expect, type Page } from '@playwright/test'
import { waitForHydration } from './sign-in'

export interface EntryInput {
  type?: 'Income' | 'Expense'
  category: string
  amount: string
  /** dd/mm/yyyy */
  date: string
  note?: string
  receipt?: { name: string; mimeType: string; buffer: Buffer }
}

/** Logs an entry for a flat through its form and waits for its Entries page. */
export async function logEntry(page: Page, flatId: string, entry: EntryInput) {
  await page.goto(`/transactions/new?propertyId=${flatId}`)
  await waitForHydration(page)
  await fillEntry(page, entry)
  await page.getByRole('button', { name: /^Save (income|expense)$/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Entries', exact: true }),
  ).toBeVisible()
}

export async function fillEntry(page: Page, entry: EntryInput) {
  if (entry.type) {
    await page.getByRole('button', { name: entry.type, exact: true }).click()
  }
  await page.getByRole('button', { name: entry.category, exact: true }).click()
  await page.getByRole('textbox', { name: 'Amount' }).fill(entry.amount)
  await page.getByRole('textbox', { name: 'Date' }).fill(entry.date)
  if (entry.note !== undefined) {
    await page.getByRole('textbox', { name: 'Description' }).fill(entry.note)
  }
  if (entry.receipt) {
    await page
      .getByLabel('Take a photo or choose a file')
      .setInputFiles(entry.receipt)
  }
}

/** A real JPEG of the given size, drawn by the browser. */
export async function jpegPhoto(page: Page, width: number, height: number) {
  const base64 = await page.evaluate(
    async ([w, h]) => {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('No canvas')
      }
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, w, h)
      context.fillStyle = '#2b1b3d'
      context.fillRect(w / 4, h / 4, w / 2, h / 2)
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.9)
      })
      if (!blob) {
        throw new Error('No image')
      }
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let binary = ''
      for (const byte of bytes) {
        binary += String.fromCharCode(byte)
      }
      return btoa(binary)
    },
    [width, height] as const,
  )
  return {
    name: 'IMG_0001.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(base64, 'base64'),
  }
}

/** A small, valid PDF. */
export function pdfReceipt() {
  const text =
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'
  return {
    name: 'kuitti.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(text),
  }
}
