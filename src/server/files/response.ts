// The response for a stored file, once the caller has checked that the user
// may see it. The headers keep a stored file from running as a page in the
// app's origin and from being cached by shared caches.
import type { StoredFile } from './storage'

/** Characters allowed in the ASCII fallback of a download file name. */
const UNSAFE_FILENAME = /[^\w.\- ]/g

/**
 * A file name for `filename*` (RFC 8187): encodeURIComponent leaves
 * ' ( ) * and ! as they are, but they are not allowed there.
 */
function encodeFilename(name: string): string {
  return encodeURIComponent(name).replace(
    /['()*!]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

export function fileResponse(
  file: StoredFile,
  options: { filename: string; download?: boolean },
): Response {
  const disposition = options.download ? 'attachment' : 'inline'
  const fallback = options.filename.replace(UNSAFE_FILENAME, '_')
  return new Response(file.body, {
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.size),
      // RFC 6266: an ASCII fallback and the UTF-8 name (e.g. "kuitti_äö.pdf").
      'Content-Disposition': `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeFilename(options.filename)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      // A PDF or image opened directly gets no scripts and no access to the
      // app's cookies or storage.
      'Content-Security-Policy':
        "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  })
}
