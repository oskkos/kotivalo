// A cap on request bodies. A server function's FormData is parsed whole
// before any of our code sees it, so the upload limit is enforced here,
// before the app reads the body: otherwise a large body would sit in the
// isolate's memory (128 MB) before a size check could refuse it.
import { MAX_UPLOAD_BYTES } from '#/server/files/upload'
import { createRequestLogger } from './version.server'

/** The largest body: a receipt at the upload limit and the form's fields. */
export const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024

/**
 * The body's bytes, or undefined once it passes `maxBytes`: a stated
 * Content-Length over the limit is refused unread, and a longer body is
 * cancelled as soon as it passes it.
 */
export async function readAtMost(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | undefined> {
  const stated = Number(request.headers.get('content-length') ?? 0)
  if (stated > maxBytes) {
    return undefined
  }
  if (request.body === null) {
    return new Uint8Array()
  }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      return undefined
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/**
 * Hands the request on if its body is within `maxBytes`, or answers 413.
 * A body with a stated Content-Length within the limit is passed on unread
 * (the runtime holds it to that length); one without is read first, up to
 * the limit.
 */
export async function withBodyLimit(
  request: Request,
  maxBytes: number,
  handle: (request: Request) => Promise<Response>,
): Promise<Response> {
  const stated = request.headers.get('content-length')
  if (
    request.body === null ||
    (stated !== null && Number(stated) <= maxBytes)
  ) {
    return handle(request)
  }
  const bytes =
    stated === null ? await readAtMost(request, maxBytes) : undefined
  if (bytes === undefined) {
    createRequestLogger().warn('http.body_too_large', {
      method: request.method,
      path: new URL(request.url).pathname,
    })
    return new Response(null, { status: 413 })
  }
  return handle(new Request(request, { body: bytes }))
}
