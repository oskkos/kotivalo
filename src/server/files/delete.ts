// Removing stored files after the rows that point to them are gone: a file
// without a row is invisible and harmless, a row without a file is a broken
// receipt, so the rows go first and a failure here is only logged.
import type { Logger, LogEvent } from '#/server/log/log'
import type { FileStorage } from './storage'

/**
 * Deletes the files in as few calls as the storage allows. A failure leaves
 * orphan files and is logged at `error` as `event` with the number of keys
 * (never the keys); it is not thrown, because the rows are already gone.
 */
export async function deleteStoredFiles(
  storage: FileStorage,
  log: Logger,
  keys: readonly string[],
  event: LogEvent,
): Promise<void> {
  if (keys.length === 0) {
    return
  }
  try {
    await storage.deleteMany(keys)
  } catch (error) {
    log.error(event, { count: keys.length }, error)
  }
}
