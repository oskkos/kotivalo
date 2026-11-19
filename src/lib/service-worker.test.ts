import { afterEach, describe, expect, test, vi } from 'vitest'
import { clientLog } from './client-log'
import { registerServiceWorker } from './service-worker'

vi.mock('./client-log', () => ({ clientLog: { warn: vi.fn() } }))

function stubServiceWorker(register: () => Promise<unknown>) {
  const stub = vi.fn(register)
  vi.stubGlobal('navigator', { serviceWorker: { register: stub } })
  return stub
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('registerServiceWorker', () => {
  test('registers /sw.js when enabled', () => {
    const register = stubServiceWorker(() => Promise.resolve({}))
    registerServiceWorker({ enabled: true })
    expect(register).toHaveBeenCalledWith('/sw.js')
  })

  test('does nothing when disabled, as in development', () => {
    const register = stubServiceWorker(() => Promise.resolve({}))
    registerServiceWorker({ enabled: false })
    expect(register).not.toHaveBeenCalled()
  })

  test('does nothing in a browser without service workers', () => {
    vi.stubGlobal('navigator', {})
    expect(() => {
      registerServiceWorker({ enabled: true })
    }).not.toThrow()
  })

  test('logs a refused registration as a warning', async () => {
    stubServiceWorker(() =>
      Promise.reject(new DOMException('denied', 'SecurityError')),
    )
    registerServiceWorker({ enabled: true })
    await vi.waitFor(() => {
      expect(clientLog.warn).toHaveBeenCalledWith('app.service_worker_failed', {
        reason: 'SecurityError',
      })
    })
  })
})
