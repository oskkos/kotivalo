import { describe, expect, test, vi } from 'vitest'
import { addLogContext, currentLogContext } from './log-context.server'
import { createCaptureLogger } from './logger.server'
import { handleTraced } from './request.server'

const TRACE = '4bf92f3577b34da6a3ce929d0e0e4736'

function request(headers: HeadersInit = {}) {
  return new Request('http://localhost/sign-in', { headers })
}

describe('Request tracing', () => {
  test("continues the browser's trace and returns its id", async () => {
    let seen: unknown
    const response = await handleTraced(
      request({ traceparent: `00-${TRACE}-00f067aa0ba902b7-01` }),
      () => {
        seen = currentLogContext().traceId
        return Promise.resolve(new Response('ok'))
      },
    )
    expect(seen).toBe(TRACE)
    expect(response.headers.get('x-trace-id')).toBe(TRACE)
    expect(await response.text()).toBe('ok')
  })

  test('starts a new trace without a valid traceparent', async () => {
    const response = await handleTraced(request(), () =>
      Promise.resolve(new Response('ok')),
    )
    expect(response.headers.get('x-trace-id')).toMatch(/^[0-9a-f]{32}$/)
  })

  test('puts the trace id, the user id and the version on every line', async () => {
    const { log, lines } = createCaptureLogger()
    await handleTraced(
      request({ traceparent: `00-${TRACE}-00f067aa0ba902b7-01` }),
      () => {
        addLogContext({ userId: 'user-1' })
        log.info('authentication.signed_in')
        return Promise.resolve(new Response('ok'))
      },
    )
    expect(lines[0]).toMatchObject({ traceId: TRACE, userId: 'user-1' })
  })

  test('logs a thrown error and answers 500', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = await handleTraced(request(), () =>
      Promise.reject(new Error('boom')),
    )
    expect(response.status).toBe(500)
    const line = JSON.parse(String(error.mock.calls[0]?.[0])) as Record<
      string,
      unknown
    >
    expect(line).toMatchObject({
      event: 'http.unhandled_error',
      errorMessage: 'boom',
      traceId: response.headers.get('x-trace-id'),
    })
    expect(line).toHaveProperty('versionId')
  })
})
