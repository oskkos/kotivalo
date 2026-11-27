// A request that never reached the server: offline, or cancelled because the
// page was reloaded or left. Nothing to fix on our side, so it is a warning
// and the user is told to check the connection (spec: "Telling the user
// when the connection fails").
import type { AlertReason } from './reasons'

// Browsers throw a TypeError with their own message; there is no standard
// property to check.
const NETWORK_MESSAGES = [
  'Failed to fetch', // Chromium
  'NetworkError when attempting to fetch resource.', // Firefox
  'Load failed', // Safari
]

// A module loaded on demand (`import()`) that could not be fetched: offline,
// or its file gone after a deploy. The message ends with the module's URL in
// Chromium and Firefox, so these are prefixes.
const MODULE_LOAD_PREFIXES = [
  'Failed to fetch dynamically imported module', // Chromium
  'error loading dynamically imported module', // Firefox
  'Importing a module script failed', // Safari
]

export function isNetworkError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }
  if (!(error instanceof TypeError)) {
    return false
  }
  return (
    NETWORK_MESSAGES.includes(error.message) ||
    MODULE_LOAD_PREFIXES.some((prefix) => error.message.startsWith(prefix))
  )
}

/** The alert for a request that failed by throwing. */
export function failureReason(
  error: unknown,
): Extract<AlertReason, 'network' | 'unexpected'> {
  return isNetworkError(error) ? 'network' : 'unexpected'
}
