import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CLIENT_LOG_BATCH, clientLog, flushClientLog } from './client-log'

const fetchMock = vi.fn(() =>
  Promise.resolve(new Response(null, { status: 204 })),
)

function sentBodies() {
  return fetchMock.mock.calls.map(
    (call) =>
      JSON.parse(
        (call as unknown as [string, RequestInit])[1].body as string,
      ) as {
        traceId: string
        events: {
          level: string
          event: string
          path: string
          error?: { message: string }
        }[]
      },
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  flushClientLog()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  fetchMock.mockClear()
})

describe('clientLog', () => {
  test('sends an error at once, with the page trace and path', () => {
    clientLog.error(
      'authentication.verify_failed',
      { step: 'code' },
      new Error('boom'),
    )

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/log',
      expect.objectContaining({ method: 'POST', keepalive: true }),
    )
    const body = sentBodies().at(0)
    expect(body?.traceId).toMatch(/^[0-9a-f]{32}$/)
    expect(body?.events[0]).toMatchObject({
      level: 'error',
      event: 'authentication.verify_failed',
      path: '/',
      fields: { step: 'code' },
      error: { name: 'Error', message: 'boom' },
    })
  })

  test('batches other lines and sends them after a moment', () => {
    clientLog.info('app.page_shown')
    clientLog.warn('app.slow_request', { ms: 3000 })
    expect(fetchMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(5000)

    expect(sentBodies().map((b) => b.events.length)).toEqual([2])
  })

  test(`sends at most ${String(CLIENT_LOG_BATCH)} lines per request`, () => {
    for (let i = 0; i < CLIENT_LOG_BATCH * 2 + 1; i++) {
      clientLog.info('app.page_shown')
    }
    flushClientLog()
    expect(sentBodies().map((b) => b.events.length)).toEqual([
      CLIENT_LOG_BATCH,
      CLIENT_LOG_BATCH,
      1,
    ])
  })

  test('the same page keeps the same trace', () => {
    clientLog.error('app.uncaught_error')
    clientLog.error('app.uncaught_error')
    const [first, second] = sentBodies().map((b) => b.traceId)
    expect(first).toBe(second)
  })
})
