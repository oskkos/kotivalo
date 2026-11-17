// Checks an uploaded file before it is stored. The type comes from the
// file's first bytes, not from the browser's Content-Type or the file name,
// so a renamed file can't pass as a receipt image.

/** Uploads above this are refused (receipts are resized in the browser). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export type UploadType =
  'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

export type UploadProblem = 'empty' | 'too_large' | 'unsupported_type'

export class UploadError extends Error {
  override name = 'UploadError'

  constructor(readonly problem: UploadProblem) {
    super(`Upload refused: ${problem}`)
  }
}

const startsWith = (
  bytes: Uint8Array,
  signature: ArrayLike<number>,
  offset = 0,
) => Array.from(signature).every((byte, i) => bytes[offset + i] === byte)

const ascii = (text: string) => new TextEncoder().encode(text)

/** The file type by its signature ("magic bytes"), if it is one we accept. */
export function detectType(bytes: Uint8Array): UploadType | undefined {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg'
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png'
  }
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) {
    return 'image/webp'
  }
  if (startsWith(bytes, ascii('%PDF-'))) {
    return 'application/pdf'
  }
  return undefined
}

/** The checked type and size of an upload, or an UploadError. */
export function checkUpload(bytes: Uint8Array): {
  contentType: UploadType
  size: number
} {
  if (bytes.byteLength === 0) {
    throw new UploadError('empty')
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new UploadError('too_large')
  }
  const contentType = detectType(bytes)
  if (!contentType) {
    throw new UploadError('unsupported_type')
  }
  return { contentType, size: bytes.byteLength }
}
