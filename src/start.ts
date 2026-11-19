// TanStack Start's global setup:
// - Server functions are same-origin calls only: a call from another site is
//   refused with 403 (Sec-Fetch-Site, then Origin, then Referer). Session
//   cookies are SameSite=Lax, which already stops cross-site POSTs; this
//   covers GETs and browsers that don't send SameSite.
// - Every server function call from the browser carries the page's trace
//   (src/lib/trace.ts), so the server's log lines for it share the browser's
//   trace id.
import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'
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

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  functionMiddleware: [traceMiddleware],
}))
