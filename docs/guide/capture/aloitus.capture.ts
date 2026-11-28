// Aloitus: signing in with a code, the name, the account page.
import { expect, test } from '@playwright/test'
import {
  codeFor,
  giveName,
  useOwnClientIp,
  waitForHydration,
} from '../../../e2e/support/sign-in'
import { newAddress } from './demo'
import { ANNIKA } from './paths'
import { shot } from './shot'

test('Signing in for the first time', async ({ page }) => {
  const email = newAddress('uusi.kayttaja')
  await useOwnClientIp(page)
  await page.goto('/sign-in')
  await waitForHydration(page)
  await shot(page, 'sign-in-email')

  await page.getByRole('textbox', { name: 'Sähköposti' }).fill(email)
  await page.getByRole('button', { name: 'Lähetä koodi' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Syötä koodi',
  )
  await shot(page, 'sign-in-code')

  await page
    .getByLabel('Kirjautumiskoodi')
    .fill(await codeFor(page.request, email))
  await page.waitForURL(/\/welcome/)
  await waitForHydration(page)
  await page.getByRole('textbox', { name: 'Nimi' }).fill('Annika')
  await shot(page, 'welcome-name')

  await giveName(page, 'Annika')
  await page.waitForURL('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await shot(page, 'flats-empty')
})

test.describe('The account page', () => {
  test.use({ storageState: ANNIKA })

  test('The account page and its sections', async ({ page }) => {
    await page.goto('/account')
    await waitForHydration(page)
    await shot(page, 'account')

    await page.getByRole('button', { name: 'Muuta nimeä' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await shot(page, 'account-change-name')
  })
})
