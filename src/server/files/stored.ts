// What the features that store uploaded files share: the name kept for a
// file, and storing a file around a database write.
import type { Logger, LogEvent } from '#/server/log/log'
import { deleteStoredFiles } from './delete'
import type { FileStorage } from './storage'

/** The longest stored file name, in characters. */
const MAX_FILENAME_LENGTH = 100

/**
 * The browser's file name without control characters, at most 100 long.
 * Without a usable name it is `<fallback>.pdf` or `<fallback>.jpg`.
 */
export function uploadFilename(
  name: string,
  contentType: string,
  fallback: string,
): string {
  const cleaned = name
    .replace(/\p{Cc}/gu, '')
    .trim()
    .slice(-MAX_FILENAME_LENGTH)
  if (cleaned !== '') {
    return cleaned
  }
  const extension = contentType === 'application/pdf' ? 'pdf' : 'jpg'
  return `${fallback}.${extension}`
}

/**
 * Runs a database write after storing a file; removes the file if the write
 * throws or doesn't apply. A failed removal is logged as `failureEvent`.
 */
export async function withStoredFile<T>(
  deps: { storage: FileStorage; log: Logger },
  failureEvent: LogEvent,
  key: string | undefined,
  write: () => Promise<T>,
  applied: (result: T) => boolean,
): Promise<T> {
  const remove = () =>
    deleteStoredFiles(deps.storage, deps.log, [key ?? ''], failureEvent)
  let result: T
  try {
    result = await write()
  } catch (error) {
    if (key) {
      await remove()
    }
    throw error
  }
  if (key && !applied(result)) {
    await remove()
  }
  return result
}
