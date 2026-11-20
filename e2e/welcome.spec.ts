import { expect, test } from '@playwright/test'
import { enterCode, giveName, signIn, uniqueEmail } from './support/sign-in'

test.use({ locale: 'fi-FI' })

test.describe('Asking for a display name', () => {
  test('A user without a name is asked for one', async ({ page }) => {
    await enterCode(page, uniqueEmail('nimeton'))
    await page.goto('/properties/new')
    await expect(page).toHaveURL('/welcome?redirect=%2Fproperties%2Fnew')
    await expect(
      page.getByRole('heading', { name: 'Tervetuloa!' }),
    ).toBeVisible()

    await giveName(page, 'Annika')

    await expect(page).toHaveURL('/properties/new')
    await expect(
      page.getByRole('heading', { name: 'Uusi asunto' }),
    ).toBeVisible()
  })

  test('An empty name is not saved', async ({ page }) => {
    await enterCode(page, uniqueEmail('tyhja'))
    await giveName(page, '   ')

    await expect(page.getByText('Kirjoita nimi.')).toBeVisible()
    await expect(page).toHaveURL(/\/welcome/)
    await page.goto('/')
    await expect(page).toHaveURL(/\/welcome/)
  })

  test('A user with a name is not asked again', async ({ page }) => {
    await signIn(page, uniqueEmail('nimetty'), 'Annika')
    await page.goto('/welcome')
    await expect(page).toHaveURL('/')
  })
})
