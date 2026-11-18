// Logging, independent of where the lines go (CLAUDE.md, "Logging"). Server
// code gets a Logger from the request context; the platform writes JSON lines
// that Workers Logs indexes field by field.
//
// Rules:
// - Event names are `<capability>.<what_happened>` in snake_case, e.g.
//   `authentication.code_requested`, so a line maps to its OpenSpec spec.
// - No personal data: no email addresses, codes, tokens, names or amounts.
//   Use ids (the user id) or leave the value out.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** A capability, a dot, and what happened: `authentication.signed_in`. */
export type LogEvent = `${string}.${string}`

export type LogValue = string | number | boolean | null | undefined

export type LogFields = Record<string, LogValue>

export interface Logger {
  debug(event: LogEvent, fields?: LogFields): void
  info(event: LogEvent, fields?: LogFields): void
  warn(event: LogEvent, fields?: LogFields): void
  /** `error`, if given, is logged as its name, message and stack. */
  error(event: LogEvent, fields?: LogFields, error?: unknown): void
}

const EVENT = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/

export function isLogEvent(value: string): value is LogEvent {
  return EVENT.test(value)
}

/** An error as plain fields, for a log line. */
export function errorFields(error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    }
  }
  return { errorMessage: String(error) }
}
