import { expect, test, type Page } from '@playwright/test'
import { addFlat, flatId, kuusikuja } from './support/flats'
import { inbox, signIn, uniqueEmail, waitForHydration } from './support/sign-in'

// The browser's language is English, so the app is in English.

/** Signs in as a new owner named Annika and adds Kuusikuja; returns its id. */
async function ownerWithFlat(page: Page): Promise<string> {
  await signIn(page, uniqueEmail('omistaja'), 'Annika')
  await addFlat(page, kuusikuja)
  return flatId(page, kuusikuja.streetAddress)
}

async function openSharing(page: Page, id: string) {
  await page.goto(`/properties/${id}/sharing`)
  await waitForHydration(page)
}

async function invite(page: Page, email: string) {
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByRole('button', { name: 'Send invitation' }).click()
}

const pending = (page: Page) =>
  page
    .getByRole('heading', { name: 'Waiting for a reply' })
    .locator('xpath=following-sibling::*[1]')

test.describe('Inviting a user to a flat', () => {
  test('Inviting an address sends an invitation', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await page.goto(`/properties/${id}/edit`)
    await page.getByRole('link', { name: 'Sharing' }).click()
    await expect(page).toHaveURL(`/properties/${id}/sharing`)
    await waitForHydration(page)

    const invitee = uniqueEmail('kutsuttu')
    await invite(page, invitee.replace('@example.com', '@Example.com'))

    await expect(page.getByText(`Invitation sent to ${invitee}`)).toBeVisible()
    await expect(pending(page)).toContainText(invitee)
    const emails = await inbox(page.request, invitee)
    expect(emails).toHaveLength(1)
    expect(emails[0]?.subject).toBe("You're invited to a flat in Kotivalo")
    expect(emails[0]?.text).toContain('Annika (')
  })

  test('An address with a pending invitation is not invited twice', async ({
    page,
  }) => {
    const id = await ownerWithFlat(page)
    await openSharing(page, id)
    const invitee = uniqueEmail('kahdesti')
    await invite(page, invitee)
    await expect(pending(page)).toContainText(invitee)

    await invite(page, invitee)

    await expect(
      page.getByText(
        'An invitation has already been sent to this address. Cancel it first to send a new one.',
      ),
    ).toBeVisible()
    expect(await inbox(page.request, invitee)).toHaveLength(1)
  })
})

test.describe('Cancelling a flat invitation', () => {
  test('the owner cancels a pending invitation', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await openSharing(page, id)
    const invitee = uniqueEmail('peruttu')
    await invite(page, invitee)
    await expect(pending(page)).toContainText(invitee)

    await page
      .getByRole('button', { name: `Cancel the invitation to ${invitee}` })
      .click()

    await expect(page.getByText(invitee)).toHaveCount(0)
  })
})

test.describe('Listing who has access to a flat', () => {
  test("Another user can't open the Sharing page", async ({
    page,
    browser,
  }) => {
    const id = await ownerWithFlat(page)

    const other = await browser.newPage()
    await signIn(other, uniqueEmail('vieras'))
    await other.goto(`/properties/${id}/sharing`)
    await expect(
      other.getByRole('heading', { name: 'Flat not found' }),
    ).toBeVisible()
    await expect(other.getByRole('textbox')).toHaveCount(0)
    await other.close()
  })
})
