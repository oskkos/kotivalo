import { expect, test } from '@playwright/test'

// The installable app (public/manifest.webmanifest, public/sw.js).
test.describe('Installable app', () => {
  test('links a manifest whose icons load', async ({ page, request }) => {
    await page.goto('/sign-in')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    const manifest = await request.get(href ?? '')
    expect(manifest.ok()).toBe(true)

    const { icons } = (await manifest.json()) as { icons: { src: string }[] }
    for (const { src } of [
      ...icons,
      { src: '/icons/apple-touch-icon.png' },
      { src: '/favicon.svg' },
    ]) {
      expect((await request.get(src)).ok(), src).toBe(true)
    }
  })

  test('registers the service worker', async ({ page }) => {
    await page.goto('/sign-in')
    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return registration.scope
    })
    expect(new URL(scope).pathname).toBe('/')
  })

  test('shows the offline page without a connection', async ({
    page,
    context,
    baseURL,
  }) => {
    // In the language chosen earlier, like the app before sign-in.
    await context.addCookies([
      { name: 'kotivalo_locale', value: 'sv', url: baseURL ?? '' },
    ])
    await page.goto('/sign-in')
    await page.evaluate(() => navigator.serviceWorker.ready)
    // The page must be controlled before the network goes.
    await page.reload()

    await context.setOffline(true)
    await page.goto('/')

    await expect(
      page.getByRole('heading', { name: 'Ingen nätverksanslutning' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Försök igen' }),
    ).toBeVisible()

    await context.setOffline(false)
    await page.getByRole('button', { name: 'Försök igen' }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
  })
})
