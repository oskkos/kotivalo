import { describe, expect, test, vi } from 'vitest'
import { readAtMost, withBodyLimit } from './body.server'

const post = (body: BodyInit, headers: HeadersInit = {}) =>
  new Request('http://localhost/_serverFn/x', { method: 'POST', body, headers })

/** A body without a stated length, as a chunked upload sends it. */
function streamed(...chunks: number[]) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const size of chunks) {
        controller.enqueue(new Uint8Array(size))
      }
      controller.close()
    },
  })
  return new Request('http://localhost/_serverFn/x', {
    method: 'POST',
    body: stream,
  })
}

const echo = async (request: Request) =>
  new Response(String((await request.arrayBuffer()).byteLength))

describe('request body limit', () => {
  test('a body within the limit reaches the app', async () => {
    const response = await withBodyLimit(post(new Uint8Array(100)), 100, echo)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('100')
  })

  test('a stated length over the limit is refused unread', async () => {
    const handle = vi.fn(echo)
    const response = await withBodyLimit(post(new Uint8Array(101)), 100, handle)
    expect(response.status).toBe(413)
    expect(handle).not.toHaveBeenCalled()
  })

  test('a body without a length is read up to the limit', async () => {
    const within = await withBodyLimit(streamed(60, 40), 100, echo)
    expect(await within.text()).toBe('100')
    const handle = vi.fn(echo)
    const over = await withBodyLimit(streamed(60, 60), 100, handle)
    expect(over.status).toBe(413)
    expect(handle).not.toHaveBeenCalled()
  })

  test('a request without a body passes', async () => {
    const response = await withBodyLimit(
      new Request('http://localhost/'),
      100,
      () => Promise.resolve(new Response('ok')),
    )
    expect(await response.text()).toBe('ok')
  })

  test('readAtMost stops once the body passes the limit', async () => {
    expect(await readAtMost(streamed(50, 50), 100)).toHaveLength(100)
    expect(await readAtMost(streamed(50, 51), 100)).toBeUndefined()
  })
})
