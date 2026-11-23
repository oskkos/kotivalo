import { expect, test, type Page } from '@playwright/test'
import {
  addFinancingCharge,
  openAmounts,
  setAmount,
  setTreatment,
} from './support/amounts'
import { accepted, ownerWithFlat } from './support/sharing'
import { signIn, uniqueEmail, waitForHydration } from './support/sign-in'
import { addTenant, aino } from './support/tenancies'
import { logEntry } from './support/transactions'

// The browser's language is English, so the app is in English. Months and
// years are relative to today, so the tests don't age.

const today = new Date()
const thisYear = today.getFullYear()
const monthName = today.toLocaleString('en-GB', { month: 'long' })
const dd = (n: number) => String(n).padStart(2, '0')
const thisMonthStart = `01/${dd(today.getMonth() + 1)}/${String(thisYear)}`
/** Aino from January last year, rent due on the 1st, so this month is late. */
const ainoDueFirst = {
  ...aino,
  contractMade: `01/12/${String(thisYear - 2)}`,
  start: `01/01/${String(thisYear - 1)}`,
  dueDay: '1',
}

async function openDetails(page: Page, id: string) {
  await page.goto(`/properties/${id}`)
  await waitForHydration(page)
}

const rentCard = (page: Page) =>
  page.getByRole('region', { name: `${monthName} rent` })

/** Records this month's rent from the details page. */
async function markPaid(page: Page, amount?: string) {
  await rentCard(page).getByRole('button', { name: 'Mark as paid' }).click()
  const dialog = page.getByRole('dialog')
  if (amount !== undefined) {
    await dialog.getByRole('textbox', { name: 'Amount (€)' }).fill(amount)
  }
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
}

test.describe('The flat details page', () => {
  test("The rent card shows this month's status", async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, ainoDueFirst)
    await openDetails(page, id)
    await expect(
      page.getByRole('heading', { name: 'Kuusikuja 3 B 12' }),
    ).toBeVisible()
    const card = rentCard(page)
    await expect(card).toContainText('€890.00')
    await expect(card).toContainText(
      today.getDate() === 1 ? 'Due' : /\d+ days? late/,
    )
    await expect(
      card.getByRole('button', { name: 'Mark as paid' }),
    ).toBeVisible()
  })

  test('A paid month has no record button', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, ainoDueFirst)
    await openDetails(page, id)
    await markPaid(page)
    await expect(rentCard(page)).toContainText(/Paid \d\d\/\d\d/)
    await expect(
      rentCard(page).getByRole('button', { name: 'Mark as paid' }),
    ).toHaveCount(0)
  })

  test("A member sees the status but can't record a payment", async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await addTenant(page, id, ainoDueFirst)
    await openDetails(jussi, id)
    await expect(rentCard(jussi)).toContainText('€890.00')
    await expect(
      rentCard(jussi).getByRole('button', { name: 'Mark as paid' }),
    ).toHaveCount(0)
    await jussi.getByRole('button', { name: 'More actions' }).click()
    await expect(
      jussi.getByRole('menuitem', { name: 'Rent payments' }),
    ).toBeVisible()
    await expect(
      jussi.getByRole('menuitem', { name: 'End tenancy' }),
    ).toHaveCount(0)
    await expect(
      jussi.getByRole('menuitem', { name: 'Add tenant' }),
    ).toHaveCount(0)
  })

  test('Earlier months not fully paid are warned about', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, ainoDueFirst)
    await openDetails(page, id)
    await page
      .getByRole('link', {
        name: /\d+ months' rent not recorded as fully paid/,
      })
      .click()
    // It opens on the year of the newest of them, last month.
    const lastMonth = new Date(thisYear, today.getMonth() - 1, 1)
    await expect(page).toHaveURL(
      `/properties/${id}/rent?year=${String(lastMonth.getFullYear())}`,
    )
  })

  test('A vacant flat', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, {
      name: 'Pekka Virtanen',
      start: '01/06/2023',
      termEnd: '31/12/2024',
      rent: '850',
    })
    await openDetails(page, id)
    await expect(page.getByText('The flat is vacant')).toBeVisible()
    await expect(page.getByText('31/12/2024')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add tenant' })).toBeVisible()
  })

  test('A tenancy that starts later', async ({ page }) => {
    const id = await ownerWithFlat(page)
    const next = String(thisYear + 1)
    await addTenant(page, id, {
      name: 'Mikko Lehtinen',
      start: `01/01/${next}`,
      termEnd: `31/12/${next}`,
      contractMade: `01/${dd(today.getMonth() + 1)}/${String(thisYear)}`,
      rent: '910',
    })
    await openDetails(page, id)
    await expect(rentCard(page)).toContainText(`Starts 01/01/${next}`)
    await expect(
      rentCard(page).getByRole('button', { name: 'Mark as paid' }),
    ).toHaveCount(0)
  })

  test('The rent and charges with the capitalised total', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openAmounts(page, id)
    await setAmount(page, 'Rent', '890', thisMonthStart)
    await setAmount(page, 'Maintenance charge', '214', thisMonthStart)
    await addFinancingCharge(page, 'Putkiremontti', '86', thisMonthStart)
    await setTreatment(page, 'Placed in reserve', thisMonthStart)
    await openDetails(page, id)
    const amounts = page.getByRole('region', { name: 'Rent and charges' })
    await expect(amounts).toContainText('€890.00')
    await expect(amounts).toContainText('€214.00')
    await expect(amounts).toContainText('€86.00')
    await expect(amounts).toContainText('Placed in reserve')
    await expect(amounts).toContainText('€86.00 of financing charges')

    await amounts.getByRole('link', { name: 'Change' }).click()
    await expect(
      page.getByRole('heading', { name: 'Rent and charges' }),
    ).toBeVisible()
  })

  test("This year's charges open the charges page", async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openAmounts(page, id)
    await setAmount(
      page,
      'Maintenance charge',
      '214',
      `01/01/${String(thisYear)}`,
    )
    await addFinancingCharge(
      page,
      'Putkiremontti',
      '86',
      `01/03/${String(thisYear - 1)}`,
    )
    await openDetails(page, id)
    const months = today.getMonth() + 1
    const soFar = new Intl.NumberFormat('en-FI', {
      style: 'currency',
      currency: 'EUR',
    }).format(months * 300)
    const row = page.getByRole('link', { name: /^Charges by month/ })
    await expect(row).toContainText(`${String(thisYear)} so far: ${soFar}`)

    await row.click()
    await expect(page.getByRole('heading', { name: 'Charges' })).toBeVisible()
  })

  test('The latest entries', async ({ page }) => {
    const id = await ownerWithFlat(page)
    const year = String(thisYear - 1)
    for (const [date, note] of [
      [`15/10/${year}`, 'd'],
      [`12/11/${year}`, 'a'],
      [`28/10/${year}`, 'c'],
      [`03/11/${year}`, 'b'],
    ] as const) {
      await logEntry(page, id, {
        type: 'Expense',
        category: 'Annual repair',
        amount: '145',
        date,
        note,
      })
    }
    await openDetails(page, id)
    const latest = page.getByRole('region', { name: 'Latest entries' })
    const rows = latest.getByRole('listitem')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toContainText('a')
    await expect(rows.nth(1)).toContainText('b')
    await expect(rows.nth(2)).toContainText('c')
    await latest.getByRole('link', { name: 'All' }).click()
    await expect(
      page.getByRole('heading', { name: 'Entries', exact: true }),
    ).toBeVisible()
  })

  test("Another user can't open the details page", async ({
    page,
    browser,
  }) => {
    const id = await ownerWithFlat(page)
    const other = await browser.newPage()
    await signIn(other, uniqueEmail('muu'), 'Liisa')
    await other.goto(`/properties/${id}`)
    await expect(
      other.getByRole('heading', { name: 'Flat not found' }),
    ).toBeVisible()
  })
})

test.describe('Recording a rent payment', () => {
  test("Recording this month's rent from the details page", async ({
    page,
  }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, ainoDueFirst)
    await openDetails(page, id)
    await rentCard(page).getByRole('button', { name: 'Mark as paid' }).click()
    const dialog = page.getByRole('dialog', { name: `${monthName} rent paid` })
    await expect(
      dialog.getByRole('textbox', { name: 'Amount (€)' }),
    ).toHaveValue('890.00')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(rentCard(page)).toContainText(/Paid \d\d\/\d\d/)
  })

  test('A smaller amount leaves the month partly paid', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, ainoDueFirst)
    await openDetails(page, id)
    await markPaid(page, '500')
    await expect(rentCard(page)).toContainText('Partly paid')
    await expect(rentCard(page)).toContainText('€390.00 outstanding')
    await expect(
      rentCard(page).getByRole('button', { name: 'Add payment' }),
    ).toBeVisible()
  })
})
