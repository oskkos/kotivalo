import { describe, expect, test } from 'vitest'
import { fileResponse } from './response'
import type { StoredFile } from './storage'

const file = (): StoredFile => ({
  body: new Blob(['%PDF-1.7']).stream(),
  contentType: 'application/pdf',
  size: 8,
})

describe('fileResponse', () => {
  test('serves the stored file with its type and size', async () => {
    const response = fileResponse(file(), { filename: 'receipt.pdf' })
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Length')).toBe('8')
    expect(await response.text()).toBe('%PDF-1.7')
  })

  test('shows the file inline unless a download is asked for', () => {
    expect(
      fileResponse(file(), { filename: 'a.pdf' }).headers.get(
        'Content-Disposition',
      ),
    ).toMatch(/^inline;/)
    expect(
      fileResponse(file(), { filename: 'a.pdf', download: true }).headers.get(
        'Content-Disposition',
      ),
    ).toMatch(/^attachment;/)
  })

  test("encodes the characters encodeURIComponent leaves, such as ' and ( )", () => {
    const disposition = fileResponse(file(), {
      filename: "Kesko's kuitti (1)*!.pdf",
    }).headers.get('Content-Disposition')
    expect(disposition).toBe(
      `inline; filename="Kesko_s kuitti _1___.pdf"; filename*=UTF-8''Kesko%27s%20kuitti%20%281%29%2A%21.pdf`,
    )
  })

  test('encodes a non-ASCII file name and keeps the fallback safe', () => {
    const disposition = fileResponse(file(), {
      filename: 'kuitti "äö"\r\n.pdf',
    }).headers.get('Content-Disposition')
    expect(disposition).toBe(
      `inline; filename="kuitti ______.pdf"; filename*=UTF-8''kuitti%20%22%C3%A4%C3%B6%22%0D%0A.pdf`,
    )
  })

  test('keeps the file private and inert', () => {
    const { headers } = fileResponse(file(), { filename: 'a.pdf' })
    expect(headers.get('Cache-Control')).toBe('private, no-store')
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('Content-Security-Policy')).toContain('sandbox')
    expect(headers.get('Content-Security-Policy')).toContain(
      "default-src 'none'",
    )
  })
})
