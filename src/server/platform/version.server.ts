// Which code is running: the deployed Worker version and its tag, the git
// commit CI deploys with (`wrangler deploy --tag`). Locally the tag is empty.
import { env } from 'cloudflare:workers'
import type { LogFields } from '#/server/log/log'
import { createLogger, isLogLevel } from './logger.server'

export function workerVersion(): LogFields {
  const { id, tag } = env.CF_VERSION_METADATA
  return { versionId: id, commit: tag || undefined }
}

/**
 * The logger for the current request, with the version on every line and
 * LOG_LEVEL (wrangler.jsonc) as its threshold: debug locally, info deployed.
 */
export function createRequestLogger() {
  return createLogger({
    base: workerVersion(),
    minLevel: isLogLevel(env.LOG_LEVEL) ? env.LOG_LEVEL : 'info',
  })
}
