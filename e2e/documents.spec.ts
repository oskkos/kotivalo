import { expect, test, type Page } from '@playwright/test'
import { accepted, ownerWithFlat } from './support/sharing'
import { signIn, uniqueEmail, waitForHydration } from './support/sign-in'
import { addTenant, aino } from './support/tenancies'
import { jpegPhoto } from './support/transactions'
import {
  addDocument,
  fillDocument,
  openAddDocument,
  openDocuments,
  pdfFile,
} from './support/documents'

// The browser's language is English, so the app is in English.

const statement = {
  file: pdfFile('tilinpaatos_2025.pdf'),
  kind: 'Financial statement',
  name: 'Tilinpäätös 2025',
  date: '28/04/2026',
}

async function openDocument(page: Page, flatId: string, id: string) {
  await page.goto(`/properties/${flatId}/documents/${id}`)
  await waitForHydration(page)
}

const save = (page: Page) =>
  page.getByRole('button', { name: 'Save', exact: true })

test.describe('Adding a document', () => {
  test('Adding a financial statement', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await addDocument(page, flat, statement)

    await expect(
      page.getByRole('heading', { name: 'Tilinpäätös 2025', level: 1 }),
    ).toBeVisible()
    await expect(page.getByText('Financial statement').first()).toBeVisible()
    await expect(page.getByText('28/04/2026')).toBeVisible()
    await expect(page.getByText(/tilinpaatos_2025\.pdf/)).toBeVisible()

    await openDocuments(page, flat)
    const group = page.getByRole('region', { name: 'Financial statements' })
    await expect(group.getByText('Tilinpäätös 2025')).toBeVisible()
  })

  test('The name is suggested from the file', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await openAddDocument(page, flat)
    await fillDocument(page, { file: pdfFile('Vastikkeet 2026.pdf') })

    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Vastikkeet 2026',
    )
    await expect(page.getByRole('button', { name: 'Other' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const today = new Date()
    const dd = (n: number) => String(n).padStart(2, '0')
    await expect(
      page.getByRole('textbox', { name: 'Document date' }),
    ).toHaveValue(
      `${dd(today.getDate())}/${dd(today.getMonth() + 1)}/${String(today.getFullYear())}`,
    )
  })

  test('A document needs a name', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await openAddDocument(page, flat)
    await fillDocument(page, { file: pdfFile('a.pdf'), name: '' })
    await save(page).click()

    await expect(page.getByText('Give the document a name.')).toBeVisible()
    await expect(page).toHaveURL(/documents\/new$/)
  })

  test("A member can't add a document", async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    await openDocuments(jussi, id)
    await expect(jussi.getByRole('link', { name: 'Add document' })).toHaveCount(
      0,
    )
    // The add page sends a member back to the documents page.
    await jussi.goto(`/properties/${id}/documents/new`)
    await expect(jussi).toHaveURL(new RegExp(`/properties/${id}/documents$`))
  })
})

test.describe('Document files', () => {
  test('A photo is resized before upload', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await openAddDocument(page, flat)
    const photo = await jpegPhoto(page, 4000, 3000)
    await fillDocument(page, { file: photo, name: 'Vastikkeet 2026' })
    await save(page).click()
    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/)

    const src = await page
      .getByRole('button', { name: /Image of the document/ })
      .locator('img')
      .getAttribute('src')
    const size = await page.evaluate(async (url) => {
      const blob = await (await fetch(url ?? '')).blob()
      const bitmap = await createImageBitmap(blob)
      return { width: bitmap.width, height: bitmap.height }
    }, src)
    expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(2000)
    expect(size.width).toBe(2000)
  })

  test('A PDF is stored as it is', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    const file = pdfFile('sopimus.pdf')
    await addDocument(page, flat, { file })
    const href = await page
      .getByRole('link', { name: 'Open PDF' })
      .getAttribute('href')
    const response = await page.request.get(href ?? '')
    expect(response.status()).toBe(200)
    expect(Buffer.from(await response.body())).toEqual(file.buffer)
  })

  test("A file that isn't an image or a PDF is refused", async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await openAddDocument(page, flat)
    await fillDocument(page, {
      file: {
        name: 'sopimus.pdf',
        mimeType: 'text/plain',
        buffer: Buffer.from('tämä on tekstiä'),
      },
    })
    await save(page).click()

    await expect(page.getByText(/must be an image/)).toBeVisible()
    await expect(page).toHaveURL(/documents\/new$/)
  })
})

test.describe("A lease's tenancy", () => {
  test('A lease names its tenancy', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await addTenant(page, flat, aino)
    await addDocument(page, flat, {
      file: pdfFile('vuokrasopimus_aino.pdf'),
      kind: 'Lease',
    })

    await expect(page.getByText('Tenancy: Aino Koski')).toBeVisible()
  })

  test('the tenancy is asked only for a lease', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await addTenant(page, flat, aino)
    await openAddDocument(page, flat)
    await expect(page.getByRole('group', { name: 'Tenancy' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Lease', exact: true }).click()
    const group = page.getByRole('group', { name: 'Tenancy' })
    await expect(
      group.getByRole('button', { name: /Aino Koski/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      group.getByRole('button', { name: 'No tenancy' }),
    ).toBeVisible()
  })
})

test.describe('The documents page', () => {
  test('Documents are grouped by kind, newest first', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await addDocument(page, flat, {
      file: pdfFile('a.pdf'),
      kind: 'Financial statement',
      name: 'Tilinpäätös 2024',
      date: '30/04/2025',
    })
    await addDocument(page, flat, statement)
    await addDocument(page, flat, {
      file: pdfFile('c.pdf'),
      kind: 'Minutes',
      name: 'Yhtiökokous 2026',
      date: '15/05/2026',
    })

    await openDocuments(page, flat)
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'Financial statements',
      'Minutes',
    ])
    await expect(
      page
        .getByRole('region', { name: 'Financial statements' })
        .getByRole('listitem'),
    ).toHaveText([/Tilinpäätös 2025/, /Tilinpäätös 2024/])
  })

  test('Filtering by kind', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await addDocument(page, flat, statement)
    await addDocument(page, flat, {
      file: pdfFile('c.pdf'),
      kind: 'Minutes',
      name: 'Yhtiökokous 2026',
    })
    await openDocuments(page, flat)
    await page.getByRole('button', { name: 'Minutes', exact: true }).click()

    await expect(page.getByText('Yhtiökokous 2026')).toBeVisible()
    await expect(page.getByText('Tilinpäätös 2025')).toHaveCount(0)
  })

  test('A flat without documents', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await openDocuments(page, flat)

    await expect(page.getByText('No documents yet')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add document' })).toBeVisible()
  })

  test('An owner sees their storage use', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await addDocument(page, flat, statement)
    await openDocuments(page, flat)

    await expect(page.getByText(/Storage used .* of 500 MB/)).toBeVisible()
  })

  test("A member sees the documents but can't add", async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await addDocument(page, id, statement)
    await openDocuments(jussi, id)

    await expect(jussi.getByText('Tilinpäätös 2025')).toBeVisible()
    await expect(jussi.getByRole('link', { name: 'Add document' })).toHaveCount(
      0,
    )
    await expect(jussi.getByText(/Storage used/)).toHaveCount(0)
    await expect(
      jussi.getByText('Only owners add and delete documents.'),
    ).toBeVisible()
  })

  test("Another user can't open the documents page", async ({
    page,
    browser,
  }) => {
    const id = await ownerWithFlat(page)
    const stranger = await (await browser.newContext()).newPage()
    await signIn(stranger, uniqueEmail('stranger'), 'Stranger')
    await stranger.goto(`/properties/${id}/documents`)

    await expect(
      stranger.getByRole('heading', { name: 'Flat not found' }),
    ).toBeVisible()
  })
})

test.describe('Document details', () => {
  test('An owner opens a document', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await addDocument(page, flat, statement)

    await expect(page.getByRole('link', { name: 'Download' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Delete document' }),
    ).toBeVisible()
    await expect(page.getByText(/^Added by You on /)).toBeVisible()
  })

  test('A member opens a document', async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    const documentId = await addDocument(page, id, statement)
    await openDocument(jussi, id, documentId)

    await expect(jussi.getByRole('link', { name: 'Download' })).toBeVisible()
    await expect(jussi.getByRole('link', { name: 'Edit' })).toHaveCount(0)
    await expect(
      jussi.getByRole('button', { name: 'Delete document' }),
    ).toHaveCount(0)
    await expect(jussi.getByText(/^Added by Annika on /)).toBeVisible()
  })

  test('A deleted document is not found', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    const id = await addDocument(page, flat, statement)
    await page.getByRole('button', { name: 'Delete document' }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(page).toHaveURL(new RegExp(`/documents$`))

    await openDocument(page, flat, id)
    await expect(
      page.getByRole('heading', { name: 'Document not found' }),
    ).toBeVisible()
  })
})

test.describe('Viewing and downloading a document', () => {
  test('A member downloads a document', async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    const documentId = await addDocument(page, id, statement)
    const response = await jussi.request.get(
      `/api/documents/${documentId}?download=1`,
    )

    expect(response.status()).toBe(200)
    expect(response.headers()['content-disposition']).toContain(
      'attachment; filename="tilinpaatos_2025.pdf"',
    )
  })

  test("A user without access can't open a document's file", async ({
    page,
    browser,
  }) => {
    const flat = await ownerWithFlat(page)
    const documentId = await addDocument(page, flat, statement)
    const stranger = await (await browser.newContext()).newPage()
    await signIn(stranger, uniqueEmail('stranger'), 'Stranger')
    const response = await stranger.request.get(`/api/documents/${documentId}`)

    expect(response.status()).toBe(404)
    expect(await response.text()).toBe('Not found')
  })

  test('Opening an image document full screen', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await openAddDocument(page, flat)
    await fillDocument(page, {
      file: await jpegPhoto(page, 1200, 900),
      name: 'Vastikkeet 2026',
    })
    await save(page).click()
    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/)
    await page.getByRole('button', { name: /Image of the document/ }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('img')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Download' })).toBeVisible()
  })
})

test.describe('Editing a document', () => {
  test('Renaming a document', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await addDocument(page, flat, statement)
    await page.getByRole('link', { name: 'Edit' }).click()
    await waitForHydration(page)
    await page
      .getByRole('textbox', { name: 'Name' })
      .fill('Tilinpäätös ja toimintakertomus 2025')
    await save(page).click()

    await expect(
      page.getByRole('heading', {
        name: 'Tilinpäätös ja toimintakertomus 2025',
        level: 1,
      }),
    ).toBeVisible()
    await expect(page.getByText(/tilinpaatos_2025\.pdf/)).toBeVisible()
  })

  test('Changing a lease to another kind removes its tenancy', async ({
    page,
  }) => {
    const flat = await ownerWithFlat(page)
    await addTenant(page, flat, aino)
    await addDocument(page, flat, {
      file: pdfFile('sopimus.pdf'),
      kind: 'Lease',
    })
    await expect(page.getByText('Tenancy: Aino Koski')).toBeVisible()
    await page.getByRole('link', { name: 'Edit' }).click()
    await waitForHydration(page)
    await page.getByRole('button', { name: 'Other', exact: true }).click()
    await save(page).click()

    await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible()
    await expect(page.getByText('Tenancy: Aino Koski')).toHaveCount(0)
  })

  test("A member can't edit a document", async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    const documentId = await addDocument(page, id, statement)
    await jussi.goto(`/properties/${id}/documents/${documentId}/edit`)

    await expect(jussi).toHaveURL(new RegExp(`/documents/${documentId}$`))
  })
})

test.describe('Deleting a document', () => {
  test('Deleting a document and its file', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    const id = await addDocument(page, flat, statement)
    const file = `/api/documents/${id}`
    expect((await page.request.get(file)).status()).toBe(200)
    await page.getByRole('button', { name: 'Delete document' }).click()
    await expect(
      page.getByRole('dialog').getByText(/Tilinpäätös 2025 is deleted/),
    ).toBeVisible()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete' })
      .click()

    await expect(page).toHaveURL(new RegExp(`/properties/${flat}/documents$`))
    await expect(page.getByText('Tilinpäätös 2025')).toHaveCount(0)
    expect((await page.request.get(file)).status()).toBe(404)
  })

  test('Cancelling keeps the document', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    const id = await addDocument(page, flat, statement)
    await page.getByRole('button', { name: 'Delete document' }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancel' })
      .click()

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`/documents/${id}$`))
    expect((await page.request.get(`/api/documents/${id}`)).status()).toBe(200)
  })
})

test.describe('The lease on the tenancy page', () => {
  test("The current tenancy's lease", async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await addTenant(page, flat, aino)
    await addDocument(page, flat, {
      file: pdfFile('vuokrasopimus_aino.pdf'),
      kind: 'Lease',
      name: 'Vuokrasopimus Aino K.',
      date: '12/02/2025',
    })
    await page.goto(`/properties/${flat}/tenancy`)
    await waitForHydration(page)
    const card = page.getByRole('region', { name: 'Lease', exact: true })
    await expect(card).toContainText('Vuokrasopimus Aino K.')
    await expect(card).toContainText('12/02/2025 · PDF')
    await card.getByRole('link', { name: /Vuokrasopimus Aino K\./ }).click()
    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/)
  })

  test('Adding the lease from the tenancy page', async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await addTenant(page, flat, aino)
    const card = page.getByRole('region', { name: 'Lease', exact: true })
    await expect(card).toContainText("can be kept with the flat's documents")
    await card.getByRole('link', { name: 'Add the lease' }).click()
    await waitForHydration(page)
    await expect(
      page.getByRole('button', { name: 'Lease', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page
        .getByRole('group', { name: 'Tenancy' })
        .getByRole('button', { name: /Aino Koski/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page).toHaveURL(new RegExp(`/properties/${flat}/tenancy$`))
  })

  test("A member sees the lease but can't add one", async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await addTenant(page, id, aino)
    await addDocument(page, id, {
      file: pdfFile('vuokrasopimus_aino.pdf'),
      kind: 'Lease',
      name: 'Vuokrasopimus Aino K.',
    })
    await jussi.goto(`/properties/${id}/tenancy`)
    await waitForHydration(jussi)
    const card = jussi.getByRole('region', { name: 'Lease', exact: true })
    await expect(card).toContainText('Vuokrasopimus Aino K.')
    await expect(card.getByRole('link', { name: 'Add the lease' })).toHaveCount(
      0,
    )
  })
})

test.describe('Adding a document', () => {
  test("Another flat's tenancy in the address is ignored", async ({ page }) => {
    const flat = await ownerWithFlat(page)
    await addTenant(page, flat, aino)
    await page.goto(
      `/properties/${flat}/documents/new?kind=lease&tenancyId=00000000-0000-0000-0000-000000000000`,
    )
    await waitForHydration(page)
    await expect(
      page.getByRole('button', { name: 'Lease', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page
        .getByRole('group', { name: 'Tenancy' })
        .getByRole('button', { name: /Aino Koski/ }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})
