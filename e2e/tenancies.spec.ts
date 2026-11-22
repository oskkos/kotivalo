import { expect, test } from '@playwright/test'
import { addFlat, card } from './support/flats'
import { accepted, ownerWithFlat } from './support/sharing'
import { waitForHydration } from './support/sign-in'
import { addTenant, aino } from './support/tenancies'

// The browser's language is English, so the app is in English.

const nextYear = String(new Date().getFullYear() + 1)

test.describe('Adding a tenant', () => {
  test('Adding an open-ended tenancy', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await expect(
      page.getByRole('heading', { name: 'Aino Koski' }),
    ).toBeVisible()
    await expect(page.getByText('Active', { exact: true })).toBeVisible()
    await expect(page.getByText('Open-ended', { exact: true })).toBeVisible()
    await expect(page.getByText('12/02/2025')).toBeVisible()
    await expect(page.getByText('€890.00 a month')).toBeVisible()
    await expect(page.getByText('day 5 of the month')).toBeVisible()
  })

  test('Adding a fixed-term tenancy', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, {
      name: 'Mikko Lehtinen',
      start: `01/01/${nextYear}`,
      termEnd: `31/12/${nextYear}`,
      contractMade: '20/11/2026',
      rent: '910',
    })
    await expect(
      page.getByRole('heading', { name: 'Mikko Lehtinen' }),
    ).toBeVisible()
    await expect(page.getByText(`Starts 01/01/${nextYear}`)).toBeVisible()
    await expect(page.getByText(`31/12/${nextYear}`)).toBeVisible()
  })

  test('a fixed-term tenancy can be followed by the next tenant', async ({
    page,
  }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, {
      name: 'Mikko Lehtinen',
      start: `01/01/${nextYear}`,
      termEnd: `31/12/${nextYear}`,
      contractMade: '20/11/2026',
      rent: '910',
    })

    await page.getByRole('link', { name: 'Add a new tenant' }).click()

    await expect(page).toHaveURL(`/properties/${id}/tenancy/new`)
  })

  test('Adding an earlier tenancy with its ending', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await addTenant(page, id, {
      name: 'Pekka Virtanen',
      start: '01/06/2023',
      ending: { by: 'Tenant', noticeDate: '20/01/2025' },
    })
    // Aino's tenancy is still the current one; Pekka's ended before it.
    await expect(
      page.getByRole('heading', { name: 'Aino Koski' }),
    ).toBeVisible()
    const others = page.getByRole('region', { name: 'Other tenancies' })
    await expect(others).toContainText('Pekka Virtanen')
    await expect(others).toContainText('28/02/2025')
  })
})

test.describe('The tenancy page', () => {
  test('Opening the tenancy page from the edit page', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await page.goto(`/properties/${id}/edit`)
    await waitForHydration(page)
    await page.getByRole('link', { name: /Tenancy.*Aino Koski/ }).click()
    await expect(page).toHaveURL(new RegExp(`/properties/${id}/tenancy$`))
    await expect(
      page.getByRole('heading', { name: 'Aino Koski' }),
    ).toBeVisible()
  })

  test('A vacant flat offers to add a tenant', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, {
      name: 'Mikko Lehtinen',
      start: '01/03/2025',
      termEnd: '31/12/2025',
      rent: '890',
    })
    await expect(
      page.getByRole('heading', { name: 'The flat is vacant' }),
    ).toBeVisible()
    await expect(
      page.getByText(/The previous tenancy ended on 31\/12\/2025\./),
    ).toBeVisible()
    await expect(page.getByText('Mikko Lehtinen')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add tenant' })).toBeVisible()
  })

  test('Adding an earlier tenancy from the tenancy page', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await page.getByRole('link', { name: 'Add an earlier tenancy' }).click()
    await expect(page).toHaveURL(`/properties/${id}/tenancy/new`)
    await expect(
      page.getByRole('heading', { name: 'New tenant' }),
    ).toBeVisible()
  })

  test('Correcting an earlier tenancy from the list', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await addTenant(page, id, {
      name: 'Pekka Virtanen',
      start: '01/06/2023',
      ending: { by: 'Tenant', noticeDate: '20/01/2025' },
    })
    await waitForHydration(page)
    await page
      .getByRole('region', { name: 'Other tenancies' })
      .getByRole('link', { name: /Pekka Virtanen/ })
      .click()
    await expect(page).toHaveURL(
      new RegExp(`/properties/${id}/tenancy/[^/]+/edit$`),
    )
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Pekka Virtanen',
    )
  })

  test("A tenancy that hasn't started can't be ended", async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, {
      name: 'Mikko Lehtinen',
      start: `01/01/${nextYear}`,
      termEnd: `31/12/${nextYear}`,
      // Made today: the start's default would be in the future.
      contractMade: new Date().toLocaleDateString('en-GB'),
      rent: '910',
    })
    await expect(
      page.getByRole('heading', { name: 'Mikko Lehtinen' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Edit the tenancy' }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'End tenancy' })).toHaveCount(0)
  })

  test("A member sees the tenancy but can't change it", async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await addTenant(page, id, aino)
    await jussi.goto(`/properties/${id}/tenancy`)
    await waitForHydration(jussi)
    await expect(
      jussi.getByRole('heading', { name: 'Aino Koski' }),
    ).toBeVisible()
    await expect(
      jussi.getByRole('link', { name: 'Call: 040 123 4567' }),
    ).toBeVisible()
    await expect(
      jussi.getByRole('link', { name: 'Edit the tenancy' }),
    ).toHaveCount(0)
    await expect(jussi.getByRole('link', { name: 'Add tenant' })).toHaveCount(0)
    await expect(
      jussi.getByRole('link', { name: 'Add an earlier tenancy' }),
    ).toHaveCount(0)
  })

  test("a member's list of other tenancies opens no form", async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    await addTenant(page, id, {
      name: 'Mikko Lehtinen',
      start: '01/03/2023',
      termEnd: '31/12/2024',
      rent: '850',
    })
    await addTenant(page, id, aino)
    await jussi.goto(`/properties/${id}/tenancy`)
    await waitForHydration(jussi)
    const others = jussi.getByRole('region', { name: 'Other tenancies' })
    await expect(others).toContainText('Mikko Lehtinen')
    await expect(others.getByRole('link')).toHaveCount(0)
  })
})

test.describe('Editing a flat', () => {
  test('The edit page shows the tenancy card', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await page.goto(`/properties/${id}/edit`)
    await waitForHydration(page)
    await expect(
      page.getByRole('link', { name: /Tenancy.*Vacant/ }),
    ).toBeVisible()
    await addTenant(page, id, aino)
    await page.goto(`/properties/${id}/edit`)
    await waitForHydration(page)
    await expect(
      page.getByRole('link', {
        name: /Aino Koski.*Open-ended · from 01\/03\/2025/,
      }),
    ).toBeVisible()
  })
})

test.describe('The rent of a new tenancy', () => {
  test('A changed rent starts from the start month', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, {
      name: 'Mikko Lehtinen',
      start: '01/03/2025',
      termEnd: '31/12/2025',
      rent: '890',
    })
    await addTenant(page, id, {
      ...aino,
      start: '15/01/2026',
      contractMade: '10/01/2026',
      rent: '910',
    })
    await page.goto(`/properties/${id}/amounts`)
    await waitForHydration(page)
    const rent = page.getByRole('region', { name: 'Rent' })
    await expect(rent).toContainText('€910.00')
    await expect(rent).toContainText('01/01/2026')
  })
})

test.describe("Removing a tenancy that hasn't started", () => {
  test('Removing a tenancy whose tenant withdrew', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, {
      name: 'Mikko Lehtinen',
      start: `01/01/${nextYear}`,
      termEnd: `31/12/${nextYear}`,
      contractMade: new Date().toLocaleDateString('en-GB'),
      rent: '910',
    })
    await waitForHydration(page)
    await page.getByRole('link', { name: 'Edit the tenancy' }).click()
    await page.getByRole('button', { name: 'Remove tenancy' }).click()
    const dialog = page.getByRole('dialog', { name: 'Remove the tenancy?' })
    await expect(dialog).toContainText('Mikko Lehtinen')
    await dialog.getByRole('button', { name: 'Remove', exact: true }).click()

    await expect(page).toHaveURL(new RegExp(`/properties/${id}/tenancy$`))
    await expect(
      page.getByRole('heading', { name: 'The flat is vacant' }),
    ).toBeVisible()
    await expect(page.getByText('Mikko Lehtinen')).toHaveCount(0)
  })

  test('a started tenancy offers no removal', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await waitForHydration(page)
    await page.getByRole('link', { name: 'Edit the tenancy' }).click()
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Aino Koski',
    )
    await expect(
      page.getByRole('button', { name: 'Remove tenancy' }),
    ).toHaveCount(0)
  })
})

test.describe('Correcting a tenancy', () => {
  test("Correcting the tenant's phone number", async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await page.getByRole('link', { name: 'Edit the tenancy' }).click()
    await waitForHydration(page)
    const phone = page.getByRole('textbox', { name: 'Phone' })
    await phone.clear()
    await phone.fill('040 765 4321')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(new RegExp(`/properties/${id}/tenancy$`))
    await expect(
      page.getByRole('link', { name: 'Call: 040 765 4321' }),
    ).toBeVisible()
  })
})

/** dd/mm/yyyy of a date, as the English UI writes it. */
const typed = (date: Date) =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear())}`

/** The last day of next month: a month's notice given today. */
const endOfNextMonth = () => {
  const today = new Date()
  return typed(new Date(today.getFullYear(), today.getMonth() + 2, 0))
}

test.describe('Ending a tenancy', () => {
  test('The tenant gives notice', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await page.getByRole('link', { name: 'End tenancy' }).click()
    await waitForHydration(page)
    const lastDay = page.getByRole('textbox', {
      name: 'Last day of the tenancy',
    })
    await expect(lastDay).toHaveValue(endOfNextMonth())
    await page.getByRole('button', { name: 'End tenancy' }).click()
    await expect(page).toHaveURL(new RegExp(`/properties/${id}/tenancy$`))
    await expect(
      page.getByText(`Notice given · ends ${endOfNextMonth()}`),
    ).toBeVisible()
    await expect(
      page.getByText(`Tenant's notice, ${typed(new Date())}`),
    ).toBeVisible()
  })
})

test.describe('Ending a fixed-term tenancy early', () => {
  test('Ending a fixed term by agreement', async ({ page }) => {
    const id = await ownerWithFlat(page)
    const year = new Date().getFullYear()
    await addTenant(page, id, {
      name: 'Mikko Lehtinen',
      start: `01/01/${String(year)}`,
      termEnd: `31/12/${String(year + 1)}`,
      rent: '910',
    })
    await page.getByRole('link', { name: 'End tenancy' }).click()
    await waitForHydration(page)
    await expect(
      page.getByRole('button', { name: 'By agreement' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await page
      .getByRole('textbox', { name: 'Last day of the tenancy' })
      .fill(endOfNextMonth())
    await page.getByRole('button', { name: 'End tenancy' }).click()
    await expect(page).toHaveURL(new RegExp(`/properties/${id}/tenancy$`))
    await expect(
      page.getByText(`Notice given · ends ${endOfNextMonth()}`),
    ).toBeVisible()
  })
})

test.describe('Cancelling an ending', () => {
  test("Cancelling the tenant's notice", async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addTenant(page, id, aino)
    await page.getByRole('link', { name: 'End tenancy' }).click()
    await waitForHydration(page)
    await page.getByRole('button', { name: 'End tenancy' }).click()
    await expect(page).toHaveURL(new RegExp(`/properties/${id}/tenancy$`))
    await page.getByRole('button', { name: 'Cancel the ending' }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancel the ending' })
      .click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText('Active', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'End tenancy' })).toBeVisible()
  })
})

test.describe('Listing flats', () => {
  test('The card shows the tenancy status', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await addFlat(page, {
      streetAddress: 'Koivupolku 7 A 4',
      postcode: '33100',
      city: 'Tampere',
      rooms: '1 room',
      floorArea: '32',
    })
    await addTenant(page, id, aino)
    await page.getByRole('link', { name: 'End tenancy' }).click()
    await waitForHydration(page)
    await page.getByRole('button', { name: 'End tenancy' }).click()
    await expect(page).toHaveURL(new RegExp(`/properties/${id}/tenancy$`))
    await page.goto('/')
    await waitForHydration(page)
    const kuusikujaCard = card(page, 'Kuusikuja')
    await expect(kuusikujaCard).toContainText(
      `Notice given · ends ${endOfNextMonth().slice(0, 5)}`,
    )
    await expect(kuusikujaCard).toContainText('Aino Koski')
    await expect(card(page, 'Koivupolku 7 A 4')).toContainText('Vacant')
  })
})
