import { expect, test, type Page } from '@playwright/test'
import { accepted, ownerWithFlat } from './support/sharing'
import {
  addFinancingCharge,
  openAmounts,
  setAmount,
  setTreatment,
} from './support/amounts'
import { waitForHydration } from './support/sign-in'

// The browser's language is English, so the app is in English.

const section = (page: Page, name: string) => page.getByRole('region', { name })

// Upcoming changes are relative to today, so the tests don't age.
const thisYear = new Date().getFullYear()
const nextYear = thisYear + 1

/** A flat whose maintenance charge rises from 214 € to 226 € next year. */
async function raisedCharge(page: Page) {
  const id = await ownerWithFlat(page)
  await openAmounts(page, id)
  await setAmount(
    page,
    'Maintenance charge',
    '214',
    `01/01/${String(thisYear)}`,
  )
  await setAmount(
    page,
    'Maintenance charge',
    '226',
    `01/01/${String(nextYear)}`,
  )
  return id
}

test.describe('The rent and charges page', () => {
  test('Opening the rent and charges page from the details page', async ({
    page,
  }) => {
    const id = await ownerWithFlat(page)
    await page.goto(`/properties/${id}`)
    await waitForHydration(page)

    await page
      .getByRole('region', { name: 'Rent and charges' })
      .getByRole('link', { name: 'Change' })
      .click()

    await expect(page).toHaveURL(new RegExp(`/properties/${id}/amounts$`))
    await expect(
      page.getByRole('heading', { name: 'Rent and charges' }),
    ).toBeVisible()
    await expect(page.getByText('Kuusikuja 3 B 12')).toBeVisible()
  })

  test('A flat without amounts', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openAmounts(page, id)

    await expect(
      page.getByRole('heading', { name: 'Rent and charges' }),
    ).toBeVisible()
    for (const name of ['Rent', 'Maintenance charge']) {
      await expect(section(page, name).getByText('Not set')).toBeVisible()
      await expect(
        page.getByRole('button', { name: `Set: ${name}` }),
      ).toBeVisible()
    }
    const financing = section(page, 'Financing charge')
    await expect(financing.getByText('No financing charges')).toBeVisible()
    await expect(financing.getByText('Not set')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Add financing charge' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: 'Set: Treatment by the housing company',
      }),
    ).toBeVisible()
  })

  test("A member sees the amounts but can't change them", async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await openAmounts(jussi, id)

    await expect(section(jussi, 'Rent').getByText('Not set')).toBeVisible()
    await expect(
      jussi.getByText('Only owners can change the amounts.'),
    ).toBeVisible()
    await expect(
      jussi.getByRole('button', { name: /^(Set|Change):/ }),
    ).toHaveCount(0)
    await expect(
      jussi.getByRole('button', { name: 'Add financing charge' }),
    ).toHaveCount(0)
    await jussi.close()
  })

  test('The current amount and an upcoming change', async ({ page }) => {
    await raisedCharge(page)

    const charge = section(page, 'Maintenance charge')
    await expect(charge.getByText('€214.00/month')).toBeVisible()
    await expect(
      charge.getByText(`From 01/01/${String(thisYear)}`),
    ).toBeVisible()
    await expect(
      charge.getByText(`From 01/01/${String(nextYear)}: €226.00/month`),
    ).toBeVisible()
  })

  test('Several financing charges with their sum', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openAmounts(page, id)
    await addFinancingCharge(page, 'Putkiremontti', '86', '01/03/2025')
    await addFinancingCharge(page, 'Julkisivu', '42', '01/01/2026')
    await setTreatment(page, 'Placed in reserve', '01/03/2025')

    const financing = section(page, 'Financing charges')
    await expect(financing).toContainText('€128.00/month in total')
    const rows = financing.getByRole('listitem')
    await expect(rows.nth(0)).toContainText('Putkiremontti€86.00/month')
    await expect(rows.nth(1)).toContainText('Julkisivu€42.00/month')
    await expect(
      financing.getByText('Treatment by the housing company · applies to all'),
    ).toBeVisible()
  })
})

test.describe('Adding a financing charge', () => {
  test('Adding a second financing charge', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openAmounts(page, id)
    await addFinancingCharge(page, 'Putkiremontti', '86', '01/03/2025')
    await addFinancingCharge(page, 'Julkisivu', '42', '01/01/2026')

    const rows = section(page, 'Financing charges').getByRole('listitem')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1)).toContainText(
      'Julkisivu€42.00/monthFrom 01/01/2026',
    )
  })

  test('A name already in use is refused', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openAmounts(page, id)
    await addFinancingCharge(page, 'Putkiremontti', '86', '01/03/2025')

    await page.getByRole('button', { name: 'Add financing charge' }).click()
    await waitForHydration(page)
    await page.getByRole('textbox', { name: 'Name' }).fill('putkiremontti ')
    await page.getByRole('textbox', { name: 'Amount (€/month)' }).fill('42')
    await page.getByRole('textbox', { name: 'Valid from' }).fill('01/01/2026')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(
      page.getByText('The flat already has a financing charge with this name.'),
    ).toBeVisible()
  })
})

test.describe('Setting a rent or charge', () => {
  test('Setting the first rent of a flat', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openAmounts(page, id)

    await setAmount(page, 'Rent', '890', '01/03/2025')

    const rent = section(page, 'Rent')
    await expect(rent.getByText('€890.00/month')).toBeVisible()
    await expect(rent.getByText('From 01/03/2025')).toBeVisible()
  })

  test('Raising the maintenance charge from next year', async ({ page }) => {
    await raisedCharge(page)

    await page
      .getByRole('button', { name: 'Change: Maintenance charge' })
      .click()
    const history = page
      .getByRole('list', { name: 'Change history' })
      .getByRole('listitem')
    await expect(history.nth(0)).toHaveText(
      `From 01/01/${String(nextYear)}€226.00`,
    )
    await expect(history.nth(1)).toHaveText(
      `From 01/01/${String(thisYear)}€214.00`,
    )
  })

  test('The change form shows the effect on the year', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openAmounts(page, id)
    await setAmount(
      page,
      'Maintenance charge',
      '214',
      `01/01/${String(thisYear)}`,
    )

    await page
      .getByRole('button', { name: 'Change: Maintenance charge' })
      .click()
    await waitForHydration(page)
    await page
      .getByRole('textbox', { name: 'New amount (€/month)' })
      .fill('226')
    await page
      .getByRole('textbox', { name: 'Valid from' })
      .fill(`01/01/${String(nextYear)}`)

    const effect = page.getByRole('status')
    await expect(effect).toContainText('+€12.00/month (+5.6%)')
    await expect(effect).toContainText(
      `In ${String(nextYear)}, deductible expenses go up by €144.00 over 12 months`,
    )
  })
})

test.describe('Undoing the latest rent or charge change', () => {
  test('Undoing a charge increase', async ({ page }) => {
    await raisedCharge(page)

    await page
      .getByRole('button', { name: 'Change: Maintenance charge' })
      .click()
    await page.getByRole('button', { name: 'Undo the latest change' }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Undo change' })
      .click()

    const charge = section(page, 'Maintenance charge')
    await expect(charge.getByText('€214.00/month')).toBeVisible()
    await expect(charge.getByText(/: €226.00\/month/)).toHaveCount(0)
  })

  test('Undoing the only rent', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openAmounts(page, id)
    await setAmount(page, 'Rent', '890', '01/06/2025')

    await page.getByRole('button', { name: 'Change: Rent' }).click()
    await page.getByRole('button', { name: 'Undo the latest change' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('The amount is removed.')
    await dialog.getByRole('button', { name: 'Undo change' }).click()
    await expect(
      page.getByRole('heading', { name: 'Rent and charges' }),
    ).toBeVisible()
    await setAmount(page, 'Rent', '890', '01/03/2025')

    const rent = section(page, 'Rent')
    await expect(rent.getByText('€890.00/month')).toBeVisible()
    await expect(rent.getByText('From 01/03/2025')).toBeVisible()
  })
})

test.describe('The financing charge treatment', () => {
  test('Setting the treatment for the first time', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openAmounts(page, id)

    await setTreatment(page, 'Placed in reserve', '01/03/2025')

    const financing = section(page, 'Financing charge')
    await expect(financing.getByText('Placed in reserve')).toBeVisible()
    await expect(
      financing.getByText(/^From 01\/03\/2025 · added to the acquisition cost/),
    ).toBeVisible()
  })

  test('A new treatment keeps the history', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openAmounts(page, id)
    await setTreatment(page, 'Placed in reserve', '01/03/2025')
    await setTreatment(page, 'Recorded as revenue', `01/01/${String(nextYear)}`)

    await page
      .getByRole('button', { name: 'Change: Treatment by the housing company' })
      .click()
    const history = page
      .getByRole('list', { name: 'History' })
      .getByRole('listitem')
    await expect(history.nth(0)).toHaveText(
      `From 01/01/${String(nextYear)}Recorded as revenue`,
    )
    await expect(history.nth(1)).toHaveText('From 01/03/2025Placed in reserve')
  })
})

test.describe('Undoing the latest treatment change', () => {
  test('Undoing a treatment change', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openAmounts(page, id)
    await setTreatment(page, 'Placed in reserve', '01/03/2025')
    await setTreatment(page, 'Recorded as revenue', `01/01/${String(nextYear)}`)

    await page
      .getByRole('button', { name: 'Change: Treatment by the housing company' })
      .click()
    await waitForHydration(page)
    await page.getByRole('button', { name: 'Undo the latest change' }).click()
    const dialog = page.getByRole('dialog', {
      name: `Undo the treatment from 01/01/${String(nextYear)}?`,
    })
    await expect(dialog).toContainText(
      'The previous treatment, “Placed in reserve” from 01/03/2025, applies again.',
    )
    await dialog.getByRole('button', { name: 'Undo change' }).click()

    const financing = section(page, 'Financing charge')
    await expect(financing.getByText('Placed in reserve')).toBeVisible()
    await expect(financing.getByText('Recorded as revenue')).toHaveCount(0)
  })
})

test.describe('Accumulated capitalised financing charges', () => {
  test('Only capitalised months count', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openAmounts(page, id)
    // Capitalised from March to December 2025 (10 months of €80), then
    // income-recognised: €800 whenever the test runs from 2026 on.
    await addFinancingCharge(page, 'Putkiremontti', '80', '01/03/2025')
    await setAmount(page, 'Putkiremontti', '86', '01/01/2026')
    await setTreatment(page, 'Placed in reserve', '01/03/2025')
    await setTreatment(page, 'Recorded as revenue', '01/01/2026')

    await expect(
      page.getByText(
        '€800.00 of financing charges has been added to the acquisition cost so far.',
        { exact: false },
      ),
    ).toBeVisible()
  })
})
