import { describe, expect, test } from 'vitest'
import {
  checkUpload,
  detectType,
  MAX_UPLOAD_BYTES,
  UploadError,
} from './upload'

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((v) =>
      typeof v === 'string' ? Array.from(new TextEncoder().encode(v)) : [v],
    ),
  )

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10)
const PNG = bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0)
const WEBP = bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 ')
const PDF = bytes('%PDF-1.7\n')

describe('detectType', () => {
  test.each([
    ['JPEG', JPEG, 'image/jpeg'],
    ['PNG', PNG, 'image/png'],
    ['WebP', WEBP, 'image/webp'],
    ['PDF', PDF, 'application/pdf'],
  ])('recognises %s by its first bytes', (_name, file, type) => {
    expect(detectType(file)).toBe(type)
  })

  test.each([
    ['HTML', bytes('<!doctype html><script>')],
    ['SVG', bytes('<svg xmlns="http://www.w3.org/2000/svg">')],
    ['a RIFF file that is not WebP', bytes('RIFF', 0, 0, 0, 0, 'WAVEfmt ')],
    ['a GIF', bytes('GIF89a')],
    ['too few bytes', bytes(0xff, 0xd8)],
  ])('does not accept %s', (_name, file) => {
    expect(detectType(file)).toBeUndefined()
  })
})

describe('checkUpload', () => {
  test('returns the detected type and size', () => {
    expect(checkUpload(PDF)).toEqual({
      contentType: 'application/pdf',
      size: PDF.byteLength,
    })
  })

  test('accepts a file at the size limit', () => {
    const file = new Uint8Array(MAX_UPLOAD_BYTES)
    file.set(JPEG)
    expect(checkUpload(file).size).toBe(MAX_UPLOAD_BYTES)
  })

  test.each([
    ['an empty file', new Uint8Array(0), 'empty'],
    [
      'a file over the limit',
      new Uint8Array(MAX_UPLOAD_BYTES + 1),
      'too_large',
    ],
    ['an unsupported type', bytes('<html>'), 'unsupported_type'],
  ])('refuses %s', (_name, file, problem) => {
    expect(() => checkUpload(file)).toThrow(UploadError)
    expect(() => checkUpload(file)).toThrow(
      expect.objectContaining({ problem }),
    )
  })
})
