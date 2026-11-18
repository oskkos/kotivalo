// The Logger behind the request context (src/server/log/log.ts): one JSON
// object per line through console, which Workers Logs indexes field by field.
// The console method sets the level Workers Logs shows.
import {
  errorFields,
  isLogEvent,
  type LogEvent,
  type LogFields,
  type LogLevel,
  type Logger,
} from '#/server/log/log'
import { currentLogContext } from './log-context.server'

export interface LogLine extends LogFields {
  level: LogLevel
  event: LogEvent
  time: string
}

type Write = (level: LogLevel, line: LogLine) => void

const writeToConsole: Write = (level, line) => {
  const json = JSON.stringify(line)
  if (level === 'error') {
    console.error(json)
  } else if (level === 'warn') {
    console.warn(json)
  } else if (level === 'debug') {
    console.debug(json)
  } else {
    console.log(json)
  }
}

export function createLogger(
  options: {
    /** Fields on every line, e.g. the Worker version. */
    base?: LogFields
    /** The current request's fields (trace id, user id). */
    context?: () => LogFields
    write?: Write
    now?: () => Date
  } = {},
): Logger {
  const write = options.write ?? writeToConsole
  const now = options.now ?? (() => new Date())
  const context = options.context ?? currentLogContext

  const log = (level: LogLevel, event: LogEvent, fields: LogFields = {}) => {
    if (!isLogEvent(event)) {
      throw new Error(
        `Log event "${String(event)}" is not <capability>.<event>`,
      )
    }
    const all = { ...options.base, ...context(), ...fields }
    const defined = Object.entries(all).filter(
      ([, value]) => value !== undefined,
    )
    write(level, {
      ...Object.fromEntries(defined),
      level,
      event,
      time: now().toISOString(),
    })
  }

  return {
    debug: (event, fields) => {
      log('debug', event, fields)
    },
    info: (event, fields) => {
      log('info', event, fields)
    },
    warn: (event, fields) => {
      log('warn', event, fields)
    },
    error: (event, fields = {}, error) => {
      log('error', event, {
        ...fields,
        ...(error === undefined ? {} : errorFields(error)),
      })
    },
  }
}

/** For tests: a logger that keeps its lines instead of printing them. */
export function createCaptureLogger(): { log: Logger; lines: LogLine[] } {
  const lines: LogLine[] = []
  return {
    lines,
    log: createLogger({
      write: (_level, line) => {
        lines.push(line)
      },
    }),
  }
}
