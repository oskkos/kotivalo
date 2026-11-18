// POST /api/log: log lines from the browser (src/lib/client-log.ts), written
// into the server's logs with the browser's trace id. Anyone can call it, so
// it is limited, validated and scrubbed: a rate limit per IP address, a
// maximum size, known levels and well-formed event names only, and values
// that look like email addresses are replaced.
import { z } from 'zod'
import type { LogFields, Logger } from '#/server/log/log'
import { addLogContext } from './log-context.server'

export const CLIENT_LOG_LIMITS = {
  maxBytes: 16 * 1024,
  maxEvents: 20,
  perIp: { windowSeconds: 60, max: 30 },
} as const

const EMAIL = /[^\s@]+@[^\s@]+/g
const scrub = (value: string) => value.replace(EMAIL, '[email]')

const text = (max: number) => z.string().max(max).transform(scrub)
const fieldValue = z.union([text(200), z.number(), z.boolean()])

const batchSchema = z.object({
  traceId: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .optional(),
  events: z
    .array(
      z.object({
        level: z.enum(['info', 'warn', 'error']),
        event: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
        time: z.string().max(40).optional(),
        path: text(200).optional(),
        fields: z
          .record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/), fieldValue)
          .refine((f) => Object.keys(f).length <= 10)
          .optional(),
        error: z
          .object({
            name: text(100),
            message: text(500),
            stack: text(4000).optional(),
          })
          .optional(),
      }),
    )
    .min(1)
    .max(CLIENT_LOG_LIMITS.maxEvents),
})

export interface ClientLogDeps {
  log: Logger
  clientIp: string
  consumeLimit: (
    key: string,
    rule: { windowSeconds: number; max: number },
  ) => Promise<{ allowed: boolean; count: number }>
  /** The signed-in user's id, from the session cookie; never from the body. */
  userId: () => Promise<string | undefined>
}

/**
 * The body as text, or undefined once it passes `maxBytes`: a stated
 * Content-Length over the limit is refused unread, and a longer body is
 * cancelled as soon as it passes it.
 */
async function readAtMost(
  request: Request,
  maxBytes: number,
): Promise<string | undefined> {
  const stated = Number(request.headers.get('content-length') ?? 0)
  if (stated > maxBytes || request.body === null) {
    return stated > maxBytes ? undefined : ''
  }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      return undefined
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

export async function clientLogResponse(
  request: Request,
  deps: ClientLogDeps,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 })
  }
  const limit = await deps.consumeLimit(
    `log-ip:${deps.clientIp}`,
    CLIENT_LOG_LIMITS.perIp,
  )
  if (!limit.allowed) {
    // Once per window, so a flood can't use up the log quota.
    if (limit.count === CLIENT_LOG_LIMITS.perIp.max + 1) {
      deps.log.warn('app.client_log_refused', { reason: 'limit' })
    }
    return new Response(null, { status: 429 })
  }
  // Below the rate limit, so these lines are bounded per IP address too.
  const refuse = (status: 400 | 413, reason: string) => {
    deps.log.warn('app.client_log_refused', { reason })
    return new Response(null, { status })
  }
  const body = await readAtMost(request, CLIENT_LOG_LIMITS.maxBytes)
  if (body === undefined) {
    return refuse(413, 'too_large')
  }
  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return refuse(400, 'not_json')
  }
  const parsed = batchSchema.safeParse(json)
  if (!parsed.success) {
    return refuse(400, 'invalid')
  }

  const userId = await deps.userId()
  // The browser's trace replaces the one this request started with.
  addLogContext({
    ...(parsed.data.traceId === undefined
      ? {}
      : { traceId: parsed.data.traceId }),
    ...(userId === undefined ? {} : { userId }),
  })
  for (const e of parsed.data.events) {
    // The browser's own fields are prefixed, so they can't pose as the
    // server's (source, path, error*); trace, user and version come from the
    // log context and win anyway.
    const clientFields = Object.fromEntries(
      Object.entries(e.fields ?? {}).map(([key, value]) => [
        `client_${key}`,
        value,
      ]),
    )
    const fields: LogFields = {
      ...clientFields,
      source: 'client',
      clientTime: e.time,
      path: e.path,
      ...(e.error === undefined
        ? {}
        : {
            errorName: e.error.name,
            errorMessage: e.error.message,
            errorStack: e.error.stack,
          }),
    }
    const event = e.event as `${string}.${string}`
    if (e.level === 'error') {
      deps.log.error(event, fields)
    } else if (e.level === 'warn') {
      deps.log.warn(event, fields)
    } else {
      deps.log.info(event, fields)
    }
  }
  return new Response(null, { status: 204 })
}
