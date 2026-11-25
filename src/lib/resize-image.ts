// Prepares an uploaded file (a receipt or a document) in the browser before upload (design.md, "Images
// are resized in the browser"): every image is redrawn at most 2000 px on
// its long edge as JPEG, which also drops its EXIF data (location included),
// so small images are redrawn too. A PDF is sent as it is. The Worker can't
// resize images on the free plan.
import { MAX_UPLOAD_BYTES } from '#/server/files/upload'

/** The longest edge of an uploaded image, in pixels. */
export const MAX_IMAGE_EDGE = 2000

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** The file types an upload field accepts. */
export const UPLOAD_ACCEPT = [...IMAGE_TYPES, 'application/pdf'].join(',')

/** Why a chosen file can't be uploaded; each form maps it to its reason. */
export type ImageProblemKind = 'unsupported_type' | 'too_large' | 'unreadable'

export class ImageProblem extends Error {
  override name = 'ImageProblem'

  constructor(readonly problem: ImageProblemKind) {
    super(`File refused: ${problem}`)
  }
}

/** The size an image is drawn at: the long edge at most MAX_IMAGE_EDGE. */
export function fitWithin(
  width: number,
  height: number,
  edge = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  const scale = Math.min(1, edge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

const jpegName = (name: string) =>
  `${name.replace(/\.[^.]*$/, '') || 'image'}.jpg`

/**
 * The file to upload for a chosen file, or an ImageProblem with the problem
 * to show.
 */
export async function prepareUpload(file: File): Promise<File> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ImageProblem('too_large')
    }
    return file
  }
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new ImageProblem('unsupported_type')
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ImageProblem('unreadable')
  }
  const size = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new ImageProblem('unreadable')
  }
  // JPEG has no transparency: transparent areas of a PNG or WebP would turn
  // black, hiding dark text, so they become white like paper.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, size.width, size.height)
  context.drawImage(bitmap, 0, 0, size.width, size.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.85)
  })
  if (!blob) {
    throw new ImageProblem('unreadable')
  }
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new ImageProblem('too_large')
  }
  return new File([blob], jpegName(file.name), { type: 'image/jpeg' })
}
