// Asunnot: the flats list, adding and editing a flat, the housing company,
// the details page, archiving and deleting.
import { expect, test } from '@playwright/test'
import { waitForHydration } from '../../../e2e/support/sign-in'
import { koivukatu } from './demo'
import { addFlatFi, demoFlatId, fillInFlatFi } from './fi'
import { ANNIKA } from './paths'
import { shot } from './shot'

test.use({ storageState: ANNIKA })

test('The flats list and adding a flat', async ({ page }) => {
  await page.goto('/')
  await waitForHydration(page)
  await shot(page, 'flat-list')

  await page.getByRole('link', { name: 'Lisää asunto' }).first().click()
  await waitForHydration(page)
  await shot(page, 'flat-form-empty')

  await fillInFlatFi(page, {
    streetAddress: 'Mäntykatu 5 B 3',
    postcode: '33200',
    city: 'Tampere',
    rooms: 'Kolmio',
    floorArea: '62,5',
  })
  await page
    .getByRole('textbox', { name: 'Taloyhtiön nimi' })
    .fill('As Oy Mäntykatu 5')
  await page.getByRole('textbox', { name: 'Huoneiston numero' }).fill('B 3')
  await shot(page, 'flat-form-filled', { fullPage: true })
})

test('The details page and editing a flat', async ({ page }) => {
  const id = await demoFlatId(page, koivukatu.streetAddress)
  await page.goto(`/properties/${id}`)
  await waitForHydration(page)
  await shot(page, 'flat-details', { fullPage: true })

  await page.goto(`/properties/${id}/edit`)
  await waitForHydration(page)
  await shot(page, 'flat-edit', { fullPage: true })
})

test('Archiving, restoring and deleting a flat', async ({ page }) => {
  // A flat of its own, so the demo flats stay as other pages show them.
  const id = await addFlatFi(page, {
    streetAddress: 'Pihlajatie 2 A 1',
    postcode: '33500',
    city: 'Tampere',
    rooms: 'Yksiö',
    floorArea: '28',
  })
  await page.goto(`/properties/${id}`)
  await waitForHydration(page)
  await page.getByRole('button', { name: 'Muut toiminnot' }).click()
  await shot(page, 'flat-menu')

  await page.getByRole('menuitem', { name: 'Arkistoi asunto' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await shot(page, 'archive-dialog')
  await page.getByRole('button', { name: 'Arkistoi', exact: true }).click()
  await expect(
    page.getByText('Arkistoitu', { exact: false }).first(),
  ).toBeVisible()
  await shot(page, 'archived-band')

  await page.goto('/')
  await waitForHydration(page)
  await page.getByRole('button', { name: /^Arkistoidut asunnot/ }).click()
  await shot(page, 'archived-section', { fullPage: true })

  await page.goto(`/properties/${id}`)
  await waitForHydration(page)
  await page.getByRole('button', { name: 'Muut toiminnot' }).click()
  await page.getByRole('menuitem', { name: 'Poista asunto' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await shot(page, 'delete-dialog')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Poista', exact: true })
    .click()
  await expect(page).toHaveURL(/\/$/)
  await shot(page, 'flat-deleted')
})
