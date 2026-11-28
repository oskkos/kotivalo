// Finnish steps shared by the capture scripts. The demo project fills in the
// demo data in English; the pages then show Finnish forms, so a script that
// adds data of its own does it with these.
import { expect, type Page } from '@playwright/test'
import { waitForHydration } from '../../../e2e/support/sign-in'

export interface FlatFi {
  streetAddress: string
  postcode: string
  city: string
  /** The room count's button: Yksiö, Kaksio, Kolmio or 4h+. */
  rooms: string
  floorArea: string
  /** As typed, d.m.yyyy. */
  ownedSince?: string
}

/** Fills in the new flat form, without saving it. */
export async function fillInFlatFi(page: Page, flat: FlatFi): Promise<void> {
  await waitForHydration(page)
  await page
    .getByRole('textbox', { name: 'Katuosoite' })
    .fill(flat.streetAddress)
  await page.getByRole('textbox', { name: 'Postinumero' }).fill(flat.postcode)
  await page.getByRole('textbox', { name: 'Kaupunki' }).fill(flat.city)
  await page.getByRole('button', { name: flat.rooms, exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Pinta-ala (m²)' })
    .fill(flat.floorArea)
  if (flat.ownedSince !== undefined) {
    await page
      .getByRole('textbox', { name: 'Omistettu alkaen' })
      .fill(flat.ownedSince)
  }
}

/** The ids of the flats on the list, from their cards' links. */
async function listedIds(page: Page): Promise<string[]> {
  const hrefs = await page
    .getByRole('listitem')
    .getByRole('link')
    .evaluateAll((links) => links.map((l) => l.getAttribute('href') ?? ''))
  return hrefs.flatMap(
    (href) => /^\/properties\/([^/]+)$/.exec(href)?.[1] ?? [],
  )
}

/**
 * Adds a flat through the form and returns its id: the one that is new on the
 * list (a local rerun may already have a flat with the same address).
 */
export async function addFlatFi(page: Page, flat: FlatFi): Promise<string> {
  await page.goto('/')
  await waitForHydration(page)
  await page.getByRole('link', { name: 'Lisää asunto' }).first().waitFor()
  await page.getByRole('listitem').first().waitFor()
  const before = await listedIds(page)
  await page.goto('/properties/new')
  await fillInFlatFi(page, flat)
  await page.getByRole('button', { name: 'Tallenna asunto' }).click()
  await expect(page).toHaveURL(/\/$/)
  await waitForHydration(page)
  let added: string | undefined
  await expect
    .poll(async () => {
      added = (await listedIds(page)).find((id) => !before.includes(id))
      return added
    })
    .toBeDefined()
  return added ?? ''
}

/** The id of a flat on the list, from its card's link. */
export async function flatIdFi(
  page: Page,
  streetAddress: string,
): Promise<string> {
  const href = await page
    .getByRole('listitem')
    .filter({ hasText: streetAddress })
    .getByRole('link')
    .first()
    .getAttribute('href')
  const id = /\/properties\/([^/]+)$/.exec(href ?? '')?.[1]
  if (id === undefined) {
    throw new Error(`No link on the card of ${streetAddress}`)
  }
  return id
}

/** The id of a demo flat, found on the flats list. */
export async function demoFlatId(
  page: Page,
  streetAddress: string,
): Promise<string> {
  await page.goto('/')
  await waitForHydration(page)
  return flatIdFi(page, streetAddress)
}
