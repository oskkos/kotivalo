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

export function isNetworkError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }
  return error instanceof TypeError && NETWORK_MESSAGES.includes(error.message)
}

/** The alert for a request that failed by throwing. */
export function failureReason(
  error: unknown,
): Extract<AlertReason, 'network' | 'unexpected'> {
  return isNetworkError(error) ? 'network' : 'unexpected'
}
