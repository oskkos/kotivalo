// Jakaminen: inviting a user to a flat, accepting, and what a member sees.
import { expect, test } from '@playwright/test'
import { waitForHydration } from '../../../e2e/support/sign-in'
import { JUSSI_EMAIL } from './demo'
import { addFlatFi } from './fi'
import { ANNIKA, JUSSI } from './paths'
import { shot } from './shot'

test.use({ storageState: ANNIKA })

test('Inviting and accepting', async ({ page, browser }) => {
  // A flat of its own, so the demo flats stay as other pages show them.
  const id = await addFlatFi(page, {
    streetAddress: 'Lehtotie 4 C 8',
    postcode: '33710',
    city: 'Tampere',
    rooms: 'Kaksio',
    floorArea: '44',
  })
  await page.goto(`/properties/${id}/sharing`)
  await waitForHydration(page)
  await shot(page, 'sharing-page', { fullPage: true })

  await page.getByRole('textbox', { name: 'Sähköposti' }).fill(JUSSI_EMAIL)
  await page.getByRole('button', { name: 'Lähetä kutsu' }).click()
  await expect(page.getByText(JUSSI_EMAIL, { exact: true })).toBeVisible()
  await shot(page, 'invitation-sent', { fullPage: true })

  const context = await browser.newContext({
    storageState: JUSSI,
    locale: 'fi-FI',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const jussi = await context.newPage()
  await jussi.goto('/')
  await waitForHydration(jussi)
  await shot(jussi, 'invitation-card')
  await jussi.getByRole('button', { name: 'Hyväksy' }).first().click()
  await expect(
    jussi.getByRole('listitem').filter({ hasText: 'Lehtotie 4 C 8' }).first(),
  ).toBeVisible()
  await shot(jussi, 'flat-shared')
  await context.close()

  await page.goto(`/properties/${id}/sharing`)
  await waitForHydration(page)
  await shot(page, 'sharing-members', { fullPage: true })
})
