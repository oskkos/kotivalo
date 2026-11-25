// Flats from Playwright, through the app's own forms. The app is in English
// (the browser's language) unless a test sets another locale.
import { expect, type Page } from '@playwright/test'
import { waitForHydration } from './sign-in'

export async function fillInFlat(
  page: Page,
  flat: {
    streetAddress: string
    postcode: string
    city: string
    rooms: string
    floorArea: string
    /** "Owned since", as typed; the form's default (today) otherwise. */
    ownedSince?: string
    /** The housing company section, left empty when not given. */
    housingCompanyName?: string
    businessId?: string
    apartmentNumber?: string
  },
) {
  // Typing before hydration is lost when React takes over the form.
  await waitForHydration(page)
  await page
    .getByRole('textbox', { name: 'Street address' })
    .fill(flat.streetAddress)
  await page.getByRole('textbox', { name: 'Postcode' }).fill(flat.postcode)
  await page.getByRole('textbox', { name: 'City' }).fill(flat.city)
  await page.getByRole('button', { name: flat.rooms }).click()
  await page
    .getByRole('textbox', { name: 'Floor area (m²)' })
    .fill(flat.floorArea)
  const housing = {
    'Housing company name': flat.housingCompanyName,
    'Business ID': flat.businessId,
    'Apartment number': flat.apartmentNumber,
  }
  for (const [name, value] of Object.entries(housing)) {
    if (value !== undefined) {
      await page.getByRole('textbox', { name }).fill(value)
    }
  }
  if (flat.ownedSince !== undefined) {
    await page
      .getByRole('textbox', { name: 'Owned since' })
      .fill(flat.ownedSince)
  }
}

/** Adds a flat through the form and returns to the list. */
export async function addFlat(
  page: Page,
  flat: Parameters<typeof fillInFlat>[1],
) {
  await page.goto('/properties/new')
  await waitForHydration(page)
  await fillInFlat(page, flat)
  await page.getByRole('button', { name: 'Save flat' }).click()
  await expect(page).toHaveURL(/\/$/)
}

export const card = (page: Page, streetAddress: string) =>
  page.getByRole('listitem').filter({ hasText: streetAddress })

/** The id of a flat on the list, from its card's link. */
export async function flatId(page: Page, streetAddress: string) {
  const href = await card(page, streetAddress)
    .getByRole('link')
    .getAttribute('href')
  const id = /\/properties\/([^/]+)$/.exec(href ?? '')?.[1]
  if (id === undefined) {
    throw new Error(`No link on the card of ${streetAddress}`)
  }
  return id
}

export const housingCompany = {
  housingCompanyName: 'As Oy Kuusikuja 3',
  businessId: '2345678-0',
  apartmentNumber: 'B 12',
}

export const kuusikuja = {
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  rooms: '2 rooms',
  floorArea: '48,5',
}
