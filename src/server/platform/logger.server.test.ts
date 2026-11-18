import { describe, expect, test, vi } from 'vitest'
import { createLogger, type LogLine } from './logger.server'

function capture() {
  const lines: LogLine[] = []
  const log = createLogger({
    base: { version: 'v1' },
    now: () => new Date('2026-11-18T10:00:00.000Z'),
    write: (_level, line) => {
      lines.push(line)
    },
  })
  return { log, lines }
}

describe('Logger', () => {
  test('writes one structured line per event', () => {
    const { log, lines } = capture()
    log.info('authentication.code_requested', {
      locale: 'fi',
      skipped: undefined,
    })
    expect(lines).toEqual([
      {
        version: 'v1',
        locale: 'fi',
        level: 'info',
        event: 'authentication.code_requested',
        time: '2026-11-18T10:00:00.000Z',
      },
    ])
  })

  test('logs an error as its name, message and stack', () => {
    const { log, lines } = capture()
    log.error('http.unhandled_error', { path: '/' }, new TypeError('boom'))
    expect(lines[0]).toMatchObject({
      level: 'error',
      path: '/',
      errorName: 'TypeError',
      errorMessage: 'boom',
    })
    expect(lines[0]?.errorStack).toContain('TypeError: boom')
  })

  test("a call's fields can't replace the version or the request's context", () => {
    const lines: LogLine[] = []
    const log = createLogger({
      base: { versionId: 'v1' },
      context: () => ({ traceId: 't1', userId: 'u1' }),
      write: (_level, line) => {
        lines.push(line)
      },
    })
    log.info('app.x', { versionId: 'v0', traceId: 'forged', userId: 'admin' })
    expect(lines[0]).toMatchObject({
      versionId: 'v1',
      traceId: 't1',
      userId: 'u1',
    })
  })

  test('drops lines below the minimum level', () => {
    const lines: LogLine[] = []
    const log = createLogger({
      minLevel: 'info',
      write: (_level, line) => {
        lines.push(line)
      },
    })
    log.debug('app.detail')
    log.info('app.happened')
    log.error('app.failed')
    expect(lines.map((l) => l.event)).toEqual(['app.happened', 'app.failed'])
  })

  test('keeps the level and event even if a field tries to replace them', () => {
    const { log, lines } = capture()
    log.warn('authentication.limit_reached', { level: 'info', event: 'x' })
    expect(lines[0]).toMatchObject({
      level: 'warn',
      event: 'authentication.limit_reached',
    })
  })

  test('rejects an event name that is not <capability>.<event>', () => {
    const { log } = capture()
    expect(() => {
      log.info('Signed in' as 'a.b')
    }).toThrow(/not <capability>\.<event>/)
  })

  test('writes JSON through the console method of its level', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const info = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const log = createLogger()
    log.error('http.server_error', { status: 500 })
    log.info('authentication.signed_in', { userId: 'u1' })
    expect(JSON.parse(String(error.mock.calls[0]?.[0]))).toMatchObject({
      event: 'http.server_error',
      status: 500,
    })
    expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toMatchObject({
      event: 'authentication.signed_in',
    })
  })
})
