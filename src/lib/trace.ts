// W3C trace context (https://www.w3.org/TR/trace-context/): one trace id ties
// a user's action in the browser to the server function, its queries, the
// email it sends and every log line on the way.

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/

function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const newTraceId = (): string => randomHex(16)
export const newSpanId = (): string => randomHex(8)

/** The trace id in a `traceparent` header, if it is valid. */
export function traceIdFrom(
  traceparent: string | null | undefined,
): string | undefined {
  const match = TRACEPARENT.exec(traceparent?.trim().toLowerCase() ?? '')
  const traceId = match?.[1]
  // All zeros is invalid by the spec.
  return traceId === undefined || /^0+$/.test(traceId) ? undefined : traceId
}

export function traceparent(traceId: string): string {
  return `00-${traceId}-${newSpanId()}-01`
}

let pageTraceId: string | undefined

/**
 * The browser's trace id for this page load: server function calls and
 * browser log lines from the same page share it. Server-side there is none.
 */
export function browserTraceId(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }
  pageTraceId ??= newTraceId()
  return pageTraceId
}

/**
 * A short reference for an unexpected error, shown to the user: the first 8
 * characters of the page's trace id, which find the failure in the logs.
 */
export function errorReference(): string | undefined {
  return browserTraceId()?.slice(0, 8)
}
