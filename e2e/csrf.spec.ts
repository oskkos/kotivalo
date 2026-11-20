import { expect, test, type Request } from '@playwright/test'
import {
  uniqueEmail,
  useOwnClientIp,
  waitForHydration,
} from './support/sign-in'

// Server functions refuse calls from other sites (src/start.ts). The call
// is taken from the sign-in page and sent again from Playwright, which, not
// being a browser, sets Sec-Fetch-Site only when told to.
test.describe('Cross-site server function calls', () => {
  test('are refused, while same-origin calls go through', async ({ page }) => {
    await useOwnClientIp(page)
    await page.goto('/sign-in')
    await waitForHydration(page)
    const call = page.waitForRequest(
      (request) =>
        request.url().includes('/_serverFn/') && request.method() === 'POST',
    )
    await page.getByRole('textbox', { name: 'Email' }).fill(uniqueEmail('csrf'))
    await page.getByRole('button', { name: 'Send code' }).click()
    const request: Request = await call
    const headers = await request.allHeaders()

    const send = (fetchSite: string) =>
      page.request.post(request.url(), {
        headers: {
          'content-type': headers['content-type'] ?? 'application/json',
          'x-test-client-ip': headers['x-test-client-ip'] ?? '',
          'sec-fetch-site': fetchSite,
        },
        data: request.postData() ?? '',
      })

    expect((await send('cross-site')).status()).toBe(403)
    expect((await send('same-site')).status()).toBe(403)
    expect((await send('same-origin')).status()).toBe(200)
  })
})
