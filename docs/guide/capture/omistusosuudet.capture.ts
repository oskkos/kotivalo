// Omistusosuudet: the ownership history, changing the split, correcting the
// first date. The demo flat is only looked at; nothing is saved.
import { expect, test } from '@playwright/test'
import { waitForHydration } from '../../../e2e/support/sign-in'
import { koivukatu } from './demo'
import { demoFlatId } from './fi'
import { ANNIKA } from './paths'
import { shot } from './shot'

test.use({ storageState: ANNIKA })

test('Ownership history and changing the split', async ({ page }) => {
  const id = await demoFlatId(page, koivukatu.streetAddress)
  await page.goto(`/properties/${id}/sharing`)
  await waitForHydration(page)
  await shot(page, 'ownership-history', { fullPage: true })

  await page.getByRole('button', { name: 'Muuta omistusta' }).click()
  await waitForHydration(page)
  await page.getByRole('button', { name: 'Tasan' }).click()
  await shot(page, 'ownership-form', { fullPage: true })

  await page.getByRole('button', { name: 'Peru', exact: true }).click()
  await page.getByRole('button', { name: 'Korjaa päivä' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await shot(page, 'ownership-correct-date')
})
