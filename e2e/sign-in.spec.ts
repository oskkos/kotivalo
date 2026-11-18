import { expect, test } from '@playwright/test'
import {
  codeFor,
  inbox,
  requestCode,
  signIn,
  uniqueEmail,
  useOwnClientIp,
} from './support/sign-in'

test.use({ locale: 'fi-FI' })

test.describe('Sign in with an emailed code', () => {
  test('A new address creates an account and signs in', async ({ page }) => {
    const email = uniqueEmail('uusi')
    await signIn(page, email)
    await expect(page).toHaveURL('/')
  })

  test('An existing user signs in to the same account', async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail('omistaja')
    await signIn(page, email)

    const other = await browser.newPage({ locale: 'fi-FI' })
    await signIn(other, email)
    await expect(other).toHaveURL('/')
    await other.close()
  })
})

test.describe('Rejecting wrong and expired codes', () => {
  test('A wrong code shows an error', async ({ page }) => {
    const email = uniqueEmail('vaara')
    await useOwnClientIp(page)
    await requestCode(page, email)
    const code = await codeFor(page.request, email)

    const field = page.getByLabel('Kirjautumiskoodi')
    await field.fill(code === '000000' ? '111111' : '000000')

    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription(
      'Koodi ei ole oikein. Tarkista koodi ja yritä uudelleen.',
    )
    await expect(page).toHaveURL('/sign-in')
  })
})

test.describe('Requesting a new code', () => {
  test('A new code can be requested after 30 seconds', async ({ page }) => {
    await page.clock.install()
    const email = uniqueEmail('uudelleen')
    await useOwnClientIp(page)
    await requestCode(page, email)
    const resend = page.getByRole('button', { name: 'Lähetä uusi koodi' })

    await page.clock.runFor(10_000)
    await expect(resend).toBeDisabled()
    await expect(
      page.getByText('Voit pyytää uuden koodin 0:20 kuluttua.'),
    ).toBeVisible()

    await page.clock.runFor(20_000)
    await expect(resend).toBeEnabled()
    await resend.click()
    await codeFor(page.request, email, 2)
    expect(await inbox(page.request, email)).toHaveLength(2)
  })

  test('Changing the address goes back to the email step', async ({ page }) => {
    const email = uniqueEmail('vaihda')
    await useOwnClientIp(page)
    await requestCode(page, email)

    await page.getByRole('button', { name: 'Vaihda sähköpostiosoite' }).click()

    await expect(page.getByRole('textbox', { name: 'Sähköposti' })).toHaveValue(
      email,
    )
  })
})

test.describe('Choosing the language before sign-in', () => {
  test('Choosing Swedish on the sign-in page', async ({ page, context }) => {
    await page.goto('/sign-in')
    await page.getByRole('button', { name: 'Kieli: Suomi' }).click()
    await page.getByRole('menuitem', { name: 'Svenska' }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Logga in på Kotivalo' }),
    ).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'sv')

    const email = uniqueEmail('ny')
    await signIn(page, email)
    const sent = (await inbox(page.request, email)).at(0)
    expect(sent?.subject).toMatch(/är din inloggningskod för Kotivalo$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'sv')
    const cookies = await context.cookies()
    expect(cookies.find((c) => c.name === 'kotivalo_locale')?.value).toBe('sv')
  })
})
