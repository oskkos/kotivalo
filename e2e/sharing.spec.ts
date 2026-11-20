import { expect, test } from '@playwright/test'
import { card, kuusikuja } from './support/flats'
import {
  accepted,
  invitationCard,
  invite,
  invited,
  openSharing,
  ownerWithFlat,
  pending,
} from './support/sharing'
import { inbox, signIn, uniqueEmail, waitForHydration } from './support/sign-in'

// The browser's language is English, so the app is in English.

test.describe('Inviting a user to a flat', () => {
  test('Inviting an address sends an invitation', async ({ page }) => {
    const id = await ownerWithFlat(page)
    await page.goto(`/properties/${id}/edit`)
    await page.getByRole('link', { name: 'Ownership and sharing' }).click()
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
  test('The Sharing page lists people and invitations', async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await accepted(page, browser)
    const liisa = uniqueEmail('liisa')
    await openSharing(page, id)
    await invite(page, liisa)
    await expect(pending(page)).toContainText(liisa)

    await openSharing(jussi, id)

    const list = (heading: string) =>
      jussi
        .getByRole('heading', { name: heading })
        .locator('xpath=following-sibling::*[1]')
        .getByRole('listitem')
    await expect(list('Current owners')).toContainText('Annika')
    await expect(list('Current owners')).toContainText('Owner since')
    await expect(list('Others with access')).toContainText('You')
    await expect(list('Others with access')).toContainText('Member since')
    await expect(pending(jussi)).toContainText(liisa)
    await expect(jussi.getByRole('textbox', { name: 'Email' })).toHaveCount(0)
    await jussi.close()
  })

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

test.describe('Accepting a flat invitation', () => {
  test('Accepting an invitation shows the flat in the list', async ({
    page,
    browser,
  }) => {
    const { jussi } = await invited(page, browser)
    await expect(invitationCard(jussi)).toContainText(
      'Annika shared a flat with you',
    )
    await expect(invitationCard(jussi)).toContainText('Kuusikuja 3 B 12')
    await expect(invitationCard(jussi)).toContainText('Tampere')

    await invitationCard(jussi).getByRole('button', { name: 'Accept' }).click()

    await expect(card(jussi, kuusikuja.streetAddress)).toBeVisible()
    await expect(invitationCard(jussi)).toHaveCount(0)
    await jussi.close()
  })
})

test.describe('Declining a flat invitation', () => {
  test('Declining removes the invitation', async ({ page, browser }) => {
    const { jussi } = await invited(page, browser)

    await invitationCard(jussi).getByRole('button', { name: 'Decline' }).click()

    await expect(jussi.getByText('Invitation declined.')).toBeVisible()
    await expect(invitationCard(jussi)).toHaveCount(0)
    await expect(card(jussi, kuusikuja.streetAddress)).toHaveCount(0)
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Waiting for a reply' }),
    ).toHaveCount(0)
    await jussi.close()
  })
})

test.describe('Removing access to a flat', () => {
  test('The owner removes a member', async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    await openSharing(page, id)

    await page
      .getByRole('button', { name: 'Remove Jussi from the flat' })
      .click()
    await page
      .getByRole('dialog', { name: 'Remove Jussi from the flat?' })
      .getByRole('button', { name: 'Remove access' })
      .click()
    await expect(page.getByText('Jussi')).toHaveCount(0)

    await jussi.goto('/')
    await expect(card(jussi, kuusikuja.streetAddress)).toHaveCount(0)
    await jussi.goto(`/properties/${id}/edit`)
    await expect(
      jussi.getByRole('heading', { name: 'Flat not found' }),
    ).toBeVisible()
    await jussi.close()
  })
})

test.describe('Leaving a shared flat', () => {
  test('A member leaves a flat', async ({ page, browser }) => {
    const { id, jussi } = await accepted(page, browser)
    await openSharing(jussi, id)

    await jussi.getByRole('button', { name: 'Leave the flat' }).click()
    await jussi
      .getByRole('dialog', { name: 'Leave the flat?' })
      .getByRole('button', { name: 'Leave' })
      .click()

    await expect(jussi).toHaveURL('/')
    await expect(card(jussi, kuusikuja.streetAddress)).toHaveCount(0)
    await openSharing(page, id)
    await expect(page.getByText('Jussi')).toHaveCount(0)
    await jussi.close()
  })
})

test.describe('First run without flats', () => {
  test('A new user sees a pending invitation', async ({ page, browser }) => {
    const { jussi } = await invited(page, browser)

    await expect(invitationCard(jussi)).toContainText('Kuusikuja 3 B 12')
    await expect(
      jussi.getByRole('heading', { name: 'Add your first flat' }),
    ).toBeVisible()
    await jussi.close()
  })
})

test.describe('Flats are shown only to users with access', () => {
  test('A pending invitation does not give access', async ({
    page,
    browser,
  }) => {
    const { id, jussi } = await invited(page, browser)

    await expect(card(jussi, kuusikuja.streetAddress)).toHaveCount(0)
    await jussi.goto(`/properties/${id}/edit`)
    await expect(
      jussi.getByRole('heading', { name: 'Flat not found' }),
    ).toBeVisible()
    await jussi.close()
  })

  test('A member can edit a shared flat', async ({ page, browser }) => {
    const { jussi } = await accepted(page, browser)

    await card(jussi, kuusikuja.streetAddress).getByRole('link').click()
    await waitForHydration(jussi)
    await jussi.getByRole('textbox', { name: 'Floor area (m²)' }).fill('49')
    await jussi.getByRole('button', { name: 'Save flat' }).click()
    await expect(jussi).toHaveURL('/')

    await page.goto('/')
    // The area has a no-break space before m².
    await expect(card(page, kuusikuja.streetAddress)).toContainText(
      /Tampere · 2 rooms 49\sm²/,
    )
    await jussi.close()
  })
})

test.describe('Listing flats', () => {
  test("A member's card says the flat is shared with them", async ({
    page,
    browser,
  }) => {
    const { jussi } = await accepted(page, browser)

    await expect(card(jussi, kuusikuja.streetAddress)).toContainText(
      'Annika 100% · shared with you',
    )
    await jussi.close()
  })
})
