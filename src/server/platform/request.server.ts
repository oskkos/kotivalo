// Starts each request's trace: the trace id from the browser's traceparent
// header (src/lib/trace.ts), or a new one, goes into the log context for
// every line of the request and back to the browser as x-trace-id.
import { newTraceId, traceIdFrom } from '#/lib/trace'
import { runWithLogContext } from './log-context.server'
import { createRequestLogger } from './version.server'

export function handleTraced(
  request: Request,
  handle: () => Promise<Response>,
): Promise<Response> {
  const traceId =
    traceIdFrom(request.headers.get('traceparent')) ?? newTraceId()
  return runWithLogContext({ traceId }, async () => {
    const log = createRequestLogger()
    const { pathname } = new URL(request.url)
    let response: Response
    try {
      response = await handle()
    } catch (error) {
      log.error(
        'http.unhandled_error',
        { method: request.method, path: pathname },
        error,
      )
      response = new Response('Internal Server Error', { status: 500 })
    }
    if (response.status >= 500) {
      log.error('http.server_error', {
        method: request.method,
        path: pathname,
        status: response.status,
      })
    }
    const headers = new Headers(response.headers)
    headers.set('x-trace-id', traceId)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  })
}
