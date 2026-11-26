import { expect, test } from '@playwright/test'
import {
  inbox,
  requestCode,
  signIn,
  uniqueEmail,
  useOwnClientIp,
  waitForHydration,
} from './support/sign-in'

test.use({ locale: 'fi-FI' })

test.describe('The support address in every email', () => {
  test('The sign-in code email shows the Finnish support address', async ({
    page,
  }) => {
    const email = uniqueEmail('tuki')
    await useOwnClientIp(page)
    await requestCode(page, email)

    await expect
      .poll(async () => (await inbox(page.request, email)).length)
      .toBe(1)
    const sent = (await inbox(page.request, email)).at(0)
    expect(
      sent?.text.trimEnd().endsWith('Kirjoita meille: tuki@kotivalo.app'),
    ).toBe(true)
  })
})

test.describe('Help when the sign-in code does not arrive', () => {
  test('The code step shows the support address', async ({ page }) => {
    await useOwnClientIp(page)
    await requestCode(page, uniqueEmail('koodi'))

    await expect(
      page.getByText('Etkö saanut koodia? Tarkista roskaposti.'),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'tuki@kotivalo.app' }),
    ).toHaveAttribute('href', 'mailto:tuki@kotivalo.app')
  })

  test('The email step does not show it', async ({ page }) => {
    await page.goto('/sign-in')
    await waitForHydration(page)

    await expect(page.getByText('tuki@kotivalo.app')).toHaveCount(0)
  })
})

test.describe('Help and support on the account page', () => {
  test('The account page shows Help and support', async ({ page }) => {
    await signIn(page, uniqueEmail('ohje'), 'Annika')
    await page.goto('/account')
    await waitForHydration(page)

    const card = page.getByRole('region', { name: 'Ohje ja tuki' })
    await expect(
      card.getByRole('link', { name: 'tuki@kotivalo.app' }),
    ).toHaveAttribute('href', 'mailto:tuki@kotivalo.app')
    const cardBox = await card.boundingBox()
    const signOutBox = await page
      .getByRole('button', { name: 'Kirjaudu ulos' })
      .boundingBox()
    expect(cardBox?.y).toBeLessThan(signOutBox?.y ?? 0)
  })
})

test.describe('The support address follows the language', () => {
  test('Finnish shows tuki@', async ({ page }) => {
    await signIn(page, uniqueEmail('fi'), 'Annika')
    await page.goto('/account')
    await waitForHydration(page)

    await expect(
      page.getByRole('link', { name: 'tuki@kotivalo.app' }),
    ).toHaveAttribute('href', 'mailto:tuki@kotivalo.app')
  })

  test('Swedish and English show support@', async ({ page }) => {
    await signIn(page, uniqueEmail('sv'), 'Annika')
    await page.goto('/account')
    await waitForHydration(page)

    const languages = page.getByRole('group', { name: 'Kieli' })
    await languages.getByRole('button', { name: 'Svenska' }).click()
    await expect(
      page.getByRole('region', { name: 'Hjälp och support' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'support@kotivalo.app' }),
    ).toHaveAttribute('href', 'mailto:support@kotivalo.app')

    await waitForHydration(page)
    await page
      .getByRole('group', { name: 'Språk' })
      .getByRole('button', { name: 'English' })
      .click()
    await expect(
      page.getByRole('region', { name: 'Help and support' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'support@kotivalo.app' }),
    ).toHaveAttribute('href', 'mailto:support@kotivalo.app')
  })
})
