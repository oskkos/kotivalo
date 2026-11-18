// Logging in the browser. Lines are buffered and sent to the Worker
// (POST /api/log), which writes them into the same logs as the server's, with
// the same trace id (src/lib/trace.ts). Same rules as server logging: event
// names are `<capability>.<what_happened>`, no personal data.

import { browserTraceId } from './trace'

export type ClientLogLevel = 'info' | 'warn' | 'error'
export type ClientLogFields = Record<string, string | number | boolean>

export interface ClientLogEvent {
  level: ClientLogLevel
  event: string
  time: string
  path: string
  fields?: ClientLogFields
  error?: { name: string; message: string; stack?: string }
}

export const CLIENT_LOG_URL = '/api/log'
/** The most events one request carries; the server refuses more. */
export const CLIENT_LOG_BATCH = 20

const buffer: ClientLogEvent[] = []
let timer: ReturnType<typeof setTimeout> | undefined

function errorInfo(error: unknown): ClientLogEvent['error'] {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message.slice(0, 500),
      ...(error.stack === undefined
        ? {}
        : { stack: error.stack.slice(0, 4000) }),
    }
  }
  return { name: 'Error', message: String(error).slice(0, 500) }
}

/** Sends what is buffered; `beacon` survives the page being closed. */
export function flushClientLog(options: { beacon?: boolean } = {}): void {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }
  while (buffer.length > 0) {
    const events = buffer.splice(0, CLIENT_LOG_BATCH)
    const body = JSON.stringify({ traceId: browserTraceId(), events })
    if (options.beacon === true && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(
        CLIENT_LOG_URL,
        new Blob([body], { type: 'application/json' }),
      )
    } else {
      void fetch(CLIENT_LOG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => undefined)
    }
  }
}

function add(
  level: ClientLogLevel,
  event: string,
  fields?: ClientLogFields,
  error?: unknown,
) {
  if (typeof window === 'undefined') {
    return
  }
  buffer.push({
    level,
    event,
    time: new Date().toISOString(),
    // The path only: query strings may carry personal data.
    path: window.location.pathname,
    ...(fields === undefined ? {} : { fields }),
    ...(error === undefined ? {} : { error: errorInfo(error) }),
  })
  if (level === 'error' || buffer.length >= CLIENT_LOG_BATCH) {
    flushClientLog()
  } else {
    timer ??= setTimeout(() => {
      flushClientLog()
    }, 5000)
  }
}

export const clientLog = {
  info: (event: string, fields?: ClientLogFields) => {
    add('info', event, fields)
  },
  warn: (event: string, fields?: ClientLogFields) => {
    add('warn', event, fields)
  },
  error: (event: string, fields?: ClientLogFields, error?: unknown) => {
    add('error', event, fields, error)
  },
}

let installed = false

/**
 * Logs uncaught errors and unhandled rejections, and sends what is buffered
 * when the page is hidden or closed. Called once from the root route.
 */
export function installClientLogging(): void {
  if (installed || typeof window === 'undefined') {
    return
  }
  installed = true
  window.addEventListener('error', (e) => {
    clientLog.error('app.uncaught_error', {}, e.error ?? e.message)
  })
  window.addEventListener('unhandledrejection', (e) => {
    clientLog.error('app.unhandled_rejection', {}, e.reason)
  })
  window.addEventListener('pagehide', () => {
    flushClientLog({ beacon: true })
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushClientLog({ beacon: true })
    }
  })
}
