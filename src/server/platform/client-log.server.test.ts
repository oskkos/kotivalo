import { describe, expect, test } from 'vitest'
import { clientLogResponse, type ClientLogDeps } from './client-log.server'
import { runWithLogContext } from './log-context.server'
import { createCaptureLogger } from './logger.server'

const TRACE = '4bf92f3577b34da6a3ce929d0e0e4736'

function post(body: unknown) {
  return new Request('http://localhost/api/log', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function setup(overrides: Partial<ClientLogDeps> = {}) {
  const { log, lines } = createCaptureLogger()
  const deps: ClientLogDeps = {
    log,
    clientIp: '203.0.113.1',
    consumeLimit: () => Promise.resolve({ allowed: true }),
    userId: () => Promise.resolve('user-1'),
    ...overrides,
  }
  return { deps, lines }
}

const send = (request: Request, deps: ClientLogDeps) =>
  runWithLogContext({ traceId: 'server-trace' }, () =>
    clientLogResponse(request, deps),
  )

describe('Client log endpoint', () => {
  test("writes the browser's lines with its trace and the signed-in user", async () => {
    const { deps, lines } = setup()
    const response = await send(
      post({
        traceId: TRACE,
        events: [
          {
            level: 'error',
            event: 'authentication.verify_failed',
            path: '/sign-in',
            error: { name: 'TypeError', message: 'Failed to fetch' },
          },
        ],
      }),
      deps,
    )

    expect(response.status).toBe(204)
    expect(lines).toEqual([
      expect.objectContaining({
        level: 'error',
        event: 'authentication.verify_failed',
        source: 'client',
        traceId: TRACE,
        userId: 'user-1',
        path: '/sign-in',
        errorMessage: 'Failed to fetch',
      }),
    ])
  })

  test('replaces email addresses in what the browser sends', async () => {
    const { deps, lines } = setup()
    await send(
      post({
        events: [
          {
            level: 'warn',
            event: 'app.oops',
            fields: { note: 'sent to mikko@esimerkki.fi' },
            error: { name: 'Error', message: 'mikko@esimerkki.fi failed' },
          },
        ],
      }),
      deps,
    )
    expect(JSON.stringify(lines)).not.toContain('mikko@esimerkki.fi')
    expect(lines[0]).toMatchObject({ client_note: 'sent to [email]' })
  })

  test.each([
    ['not JSON', 'nope'],
    ['no events', { events: [] }],
    ['an unknown level', { events: [{ level: 'fatal', event: 'app.x' }] }],
    [
      'a malformed event name',
      { events: [{ level: 'info', event: 'Bad name' }] },
    ],
    [
      'too many events',
      { events: Array(21).fill({ level: 'info', event: 'app.x' }) },
    ],
  ])('refuses %s with 400', async (_name, body) => {
    const { deps, lines } = setup()
    expect((await send(post(body), deps)).status).toBe(400)
    expect(lines).toEqual([])
  })

  test("can't pose as the server: its fields are prefixed and context wins", async () => {
    const { deps, lines } = setup()
    await send(
      post({
        traceId: TRACE,
        events: [
          {
            level: 'info',
            event: 'app.x',
            fields: { userId: 'admin', traceId: 'forged', source: 'server' },
          },
        ],
      }),
      deps,
    )
    expect(lines[0]).toMatchObject({
      userId: 'user-1',
      traceId: TRACE,
      source: 'client',
      client_userId: 'admin',
      client_traceId: 'forged',
      client_source: 'server',
    })
  })

  test('refuses a stated Content-Length over 16 KB without reading', async () => {
    const { deps } = setup()
    const request = new Request('http://localhost/api/log', {
      method: 'POST',
      headers: { 'content-length': '1000000' },
      body: '{}',
    })
    expect((await send(request, deps)).status).toBe(413)
  })

  test('refuses a body over 16 KB with 413', async () => {
    const { deps } = setup()
    const big = {
      events: [
        { level: 'info', event: 'app.x', fields: { a: 'x'.repeat(20_000) } },
      ],
    }
    expect((await send(post(big), deps)).status).toBe(413)
  })

  test('refuses requests over the rate limit with 429', async () => {
    const { deps, lines } = setup({
      consumeLimit: () => Promise.resolve({ allowed: false }),
    })
    const response = await send(
      post({ events: [{ level: 'info', event: 'app.x' }] }),
      deps,
    )
    expect(response.status).toBe(429)
    expect(lines).toEqual([])
  })
})
