import { expect, test, type Page } from '@playwright/test'

// Before sign-in the language comes from the cookie, then the browser
// language, then defaults to Finnish (project.inlang/paraglide.config.ts).
const TAGLINE = {
  fi: 'Valoa vuokranantajan arkeen',
  sv: 'Ljus i hyresvärdens vardag',
  en: "Light for a landlord's everyday work",
}

async function expectLanguage(page: Page, locale: keyof typeof TAGLINE) {
  await expect(page.locator('html')).toHaveAttribute('lang', locale)
  await expect(page.getByText(TAGLINE[locale])).toBeVisible()
}

test.describe('Language before sign-in', () => {
  test.describe('with a supported browser language', () => {
    test.use({ locale: 'sv-FI' })

    test('uses the browser language', async ({ page }) => {
      const errors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text())
        }
      })
      await page.goto('/')
      await expectLanguage(page, 'sv')
      // The client resolves the same language as the server: no hydration
      // mismatch is reported.
      await page.waitForFunction(() => document.readyState === 'complete')
      await expectLanguage(page, 'sv')
      expect(errors).toEqual([])
    })

    test('prefers the language saved in the cookie', async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([
        { name: 'kotivalo_locale', value: 'en', url: baseURL ?? '' },
      ])
      await page.goto('/')
      await expectLanguage(page, 'en')
    })
  })

  test.describe('with an unsupported browser language', () => {
    test.use({ locale: 'de-DE' })

    test('defaults to Finnish', async ({ page }) => {
      await page.goto('/')
      await expectLanguage(page, 'fi')
    })
  })
})
