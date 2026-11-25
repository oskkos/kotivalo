import { describe, expect, test } from 'vitest'
import { uploadFilename } from './stored'

describe('uploadFilename', () => {
  test('has no control characters and a fallback', () => {
    expect(uploadFilename(' kuitti\u0000.jpg ', 'image/jpeg', 'receipt')).toBe(
      'kuitti.jpg',
    )
    expect(uploadFilename('', 'application/pdf', 'receipt')).toBe('receipt.pdf')
    expect(uploadFilename('', 'image/png', 'document')).toBe('document.jpg')
    expect(
      uploadFilename(`${'a'.repeat(150)}.jpg`, 'image/jpeg', 'receipt'),
    ).toHaveLength(100)
  })
})
