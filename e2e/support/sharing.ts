// Sharing a flat from Playwright: an owner with a flat, the Ownership and
// sharing page, and a second user who is invited or has accepted. The app is
// in English (the browser's language).
import { expect, type Browser, type Page } from '@playwright/test'
import { addFlat, card, flatId, kuusikuja } from './flats'
import { signIn, uniqueEmail, waitForHydration } from './sign-in'

/** Signs in as a new owner named Annika and adds Kuusikuja; returns its id. */
export async function ownerWithFlat(page: Page): Promise<string> {
  await signIn(page, uniqueEmail('omistaja'), 'Annika')
  // Owned since before the changes the tests record.
  await addFlat(page, { ...kuusikuja, ownedSince: '12/06/2022' })
  return flatId(page, kuusikuja.streetAddress)
}

export async function openSharing(page: Page, id: string) {
  await page.goto(`/properties/${id}/sharing`)
  await waitForHydration(page)
}

export async function invite(page: Page, email: string) {
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByRole('button', { name: 'Send invitation' }).click()
}

export const pending = (page: Page) =>
  page
    .getByRole('heading', { name: 'Waiting for a reply' })
    .locator('xpath=following-sibling::*[1]')

/**
 * Annika invites a new user, who signs in as Jussi in their own browser.
 * Returns the flat's id and Jussi's page, on `/` with the invitation.
 */
export async function invited(page: Page, browser: Browser) {
  const id = await ownerWithFlat(page)
  await openSharing(page, id)
  const email = uniqueEmail('jussi')
  await invite(page, email)
  await expect(pending(page)).toContainText(email)

  const jussi = await browser.newPage()
  await signIn(jussi, email, 'Jussi')
  await waitForHydration(jussi)
  return { id, jussi }
}

export const invitationCard = (page: Page) =>
  page.getByRole('list', { name: 'Invitations' }).getByRole('listitem')

/** Jussi accepts, and the flat is on his list. */
export async function accepted(page: Page, browser: Browser) {
  const { id, jussi } = await invited(page, browser)
  await invitationCard(jussi).getByRole('button', { name: 'Accept' }).click()
  await expect(card(jussi, kuusikuja.streetAddress)).toBeVisible()
  return { id, jussi }
}
