// Documents from Playwright, through the app's own form. The app is in
// English (the browser's language): dates are dd/mm/yyyy.
import { expect, type Page } from '@playwright/test'
import { waitForHydration } from './sign-in'

export interface DocumentInput {
  file: { name: string; mimeType: string; buffer: Buffer }
  /** The kind's button, e.g. 'Financial statement'; the form's default otherwise. */
  kind?: string
  /** The name; suggested from the file otherwise. */
  name?: string
  /** dd/mm/yyyy; today otherwise. */
  date?: string
}

/** A small, valid PDF under the given file name. */
export function pdfFile(name: string) {
  const text =
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(text) }
}

export async function openAddDocument(page: Page, flatId: string) {
  await page.goto(`/properties/${flatId}/documents/new`)
  await waitForHydration(page)
}

/** Fills in the add form without saving it. */
export async function fillDocument(page: Page, document: DocumentInput) {
  await page
    .getByLabel('Take a photo or choose a file')
    .setInputFiles(document.file)
  if (document.kind !== undefined) {
    await page.getByRole('button', { name: document.kind, exact: true }).click()
  }
  if (document.name !== undefined) {
    await page.getByRole('textbox', { name: 'Name' }).fill(document.name)
  }
  if (document.date !== undefined) {
    await page
      .getByRole('textbox', { name: 'Document date' })
      .fill(document.date)
  }
}

/**
 * Adds a document through the form and lands on its details page; returns
 * the document's id.
 */
export async function addDocument(
  page: Page,
  flatId: string,
  document: DocumentInput,
): Promise<string> {
  await openAddDocument(page, flatId)
  await fillDocument(page, document)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/)
  return /documents\/([0-9a-f-]{36})$/.exec(page.url())?.[1] ?? ''
}

export async function openDocuments(page: Page, flatId: string) {
  await page.goto(`/properties/${flatId}/documents`)
  await waitForHydration(page)
}
