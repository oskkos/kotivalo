// Registers the service worker (public/sw.js), which makes Kotivalo
// installable and shows an offline page. Only in a build: in `pnpm dev` it
// would keep Vite's files and get in the way.
import { clientLog } from './client-log'

export function registerServiceWorker(
  options: { enabled?: boolean } = {},
): void {
  const enabled = options.enabled ?? import.meta.env.PROD
  if (!enabled || !('serviceWorker' in navigator)) {
    return
  }
  // Some browsers refuse it, e.g. in private windows; the app works anyway.
  navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
    clientLog.warn('app.service_worker_failed', {
      reason: error instanceof Error ? error.name : 'unknown',
    })
  })
}
