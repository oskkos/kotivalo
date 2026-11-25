// In the component project: prepareUpload needs a DOM canvas. jsdom has no
// image decoding, so createImageBitmap and the canvas are stubbed.
import { afterEach, describe, expect, test, vi } from 'vitest'
import { fitWithin, prepareUpload, ImageProblem } from './resize-image'

const file = (type: string, size: number, name = 'kuitti.jpg') =>
  new File([new Uint8Array(size)], name, { type })

function stubImage(width: number, height: number) {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(() => Promise.resolve({ width, height, close: vi.fn() })),
  )
  const drawn: (string | number)[][] = []
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    const context = {
      fillStyle: '',
      fillRect: (...args: number[]) =>
        drawn.push([`fill ${context.fillStyle}`, ...args]),
      drawImage: (_image: unknown, ...args: number[]) =>
        drawn.push(['image', ...args]),
    }
    return context as unknown as CanvasRenderingContext2D
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    (callback) => {
      callback(new Blob([new Uint8Array(300_000)], { type: 'image/jpeg' }))
    },
  )
  return drawn
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const reason = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (error) {
    return error instanceof ImageProblem ? error.problem : error
  }
  return undefined
}

describe('upload preparation', () => {
  test('a large photo is drawn at 2000 px on its long edge as JPEG', async () => {
    const drawn = stubImage(4000, 3000)
    const prepared = await prepareUpload(
      file('image/png', 5_000_000, 'IMG_1.png'),
    )
    expect(drawn).toEqual([
      ['fill #ffffff', 0, 0, 2000, 1500],
      ['image', 0, 0, 2000, 1500],
    ])
    expect(prepared.type).toBe('image/jpeg')
    expect(prepared.name).toBe('IMG_1.jpg')
    expect(prepared.size).toBe(300_000)
  })

  test('a small image is redrawn too, so its EXIF data is dropped', async () => {
    const drawn = stubImage(1200, 900)
    const original = file('image/jpeg', 400_000)
    const prepared = await prepareUpload(original)
    expect(prepared).not.toBe(original)
    expect(prepared.type).toBe('image/jpeg')
    expect(drawn).toContainEqual(['image', 0, 0, 1200, 900])
  })

  test('a PDF is sent as it is, up to 10 MB', async () => {
    const pdf = file('application/pdf', 300_000, 'kuitti.pdf')
    expect(await prepareUpload(pdf)).toBe(pdf)
    expect(
      await reason(prepareUpload(file('application/pdf', 11 * 1024 * 1024))),
    ).toBe('too_large')
  })

  test('other types are refused, and undecodable images too', async () => {
    expect(await reason(prepareUpload(file('text/plain', 10)))).toBe(
      'unsupported_type',
    )
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.reject(new Error('bad image'))),
    )
    expect(await reason(prepareUpload(file('image/jpeg', 10)))).toBe(
      'unreadable',
    )
  })

  test('fitWithin keeps the shape and never enlarges', () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 1500, height: 2000 })
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
})
