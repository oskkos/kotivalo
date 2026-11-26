import { expect, test } from '@playwright/test'
import {
  inbox,
  requestCode,
  uniqueEmail,
  useOwnClientIp,
} from './support/sign-in'

test.describe('The support address in every email', () => {
  test.use({ locale: 'fi-FI' })

  test('The sign-in code email shows the Finnish support address', async ({
    page,
  }) => {
    const email = uniqueEmail('tuki')
    await useOwnClientIp(page)
    await requestCode(page, email)

    await expect
      .poll(async () => (await inbox(page.request, email)).length)
      .toBe(1)
    const sent = (await inbox(page.request, email)).at(0)
    expect(
      sent.text.trimEnd().endsWith('Kirjoita meille: tuki@kotivalo.app'),
    ).toBe(true)
  })
})
