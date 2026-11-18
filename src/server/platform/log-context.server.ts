// Fields every log line of the current request carries, without passing them
// around: the trace id from the start, the user id once the session is known.
// AsyncLocalStorage follows the request through every await.
import { AsyncLocalStorage } from 'node:async_hooks'
import type { LogFields } from '#/server/log/log'

const storage = new AsyncLocalStorage<LogFields>()

/** Runs `fn` with its own log context, starting from `fields`. */
export function runWithLogContext<T>(fields: LogFields, fn: () => T): T {
  return storage.run({ ...fields }, fn)
}

/** Adds fields to the current request's log context, e.g. `userId`. */
export function addLogContext(fields: LogFields): void {
  const current = storage.getStore()
  if (current) {
    Object.assign(current, fields)
  }
}

export function currentLogContext(): LogFields {
  return storage.getStore() ?? {}
}
