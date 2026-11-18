// TanStack Start's global setup. Every server function call from the browser
// carries the page's trace (src/lib/trace.ts), so the server's log lines for
// it share the browser's trace id.
import { createMiddleware, createStart } from '@tanstack/react-start'
import { browserTraceId, traceparent } from '#/lib/trace'

const traceMiddleware = createMiddleware({ type: 'function' }).client(
  ({ next }) => {
    const traceId = browserTraceId()
    return next(
      traceId === undefined
        ? {}
        : { headers: { traceparent: traceparent(traceId) } },
    )
  },
)

export const startInstance = createStart(() => ({
  functionMiddleware: [traceMiddleware],
}))
