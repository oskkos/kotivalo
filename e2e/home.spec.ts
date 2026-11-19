import { expect, test } from '@playwright/test'
import { signIn, uniqueEmail } from './support/sign-in'

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, uniqueEmail('koti'))
  })

  test('shows the app name and the flats', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('banner').getByText('kotivalo', { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Flats')
  })

  test('uses the self-hosted Nunito font', async ({ page, baseURL }) => {
    const hosts = new Set<string>()
    page.on('request', (request) => hosts.add(new URL(request.url()).origin))

    await page.goto('/')
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveCSS('font-weight', '900')
    expect(
      await page.evaluate(async () => {
        await document.fonts.ready
        return [...document.fonts].some(
          (font) =>
            font.family === 'Nunito Variable' && font.status === 'loaded',
        )
      }),
    ).toBe(true)
    // Everything, the font included, comes from the app itself.
    expect([...hosts]).toEqual([new URL(baseURL ?? '').origin])
  })
})
