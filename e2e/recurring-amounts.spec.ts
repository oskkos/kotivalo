import { expect, test, type Page } from '@playwright/test'
import { accepted, ownerWithFlat } from './support/sharing'
import { waitForHydration } from './support/sign-in'

// The browser's language is English, so the app is in English.

async function openAmounts(page: Page, id: string) {
  await page.goto(`/properties/${id}/amounts`)
  await waitForHydration(page)
}

const section = (page: Page, name: string) => page.getByRole('region', { name })

// Upcoming changes are relative to today, so the tests don't age.
const thisYear = new Date().getFullYear()
const nextYear = thisYear + 1

/** On the Rent and charges page: sets or changes an amount via its form. */
async function setAmount(
  page: Page,
  item: string,
  amount: string,
  from: string,
) {
  await page
    .getByRole('button', { name: new RegExp(`^(Set|Change): ${item}$`) })
    .click()
  await waitForHydration(page)
  await page.getByRole('textbox', { name: /amount/i }).fill(amount)
  await page.getByRole('textbox', { name: 'Valid from' }).fill(from)
  await page.getByRole('button', { name: /^Save/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Rent and charges' }),
  ).toBeVisible()
}

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
  test('A flat without amounts', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openAmounts(page, id)

    await expect(
      page.getByRole('heading', { name: 'Rent and charges' }),
    ).toBeVisible()
    for (const name of ['Rent', 'Maintenance charge', 'Financing charge']) {
      await expect(
        section(page, name).getByText('Not set').first(),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: `Set: ${name}` }),
      ).toBeVisible()
    }
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
})
