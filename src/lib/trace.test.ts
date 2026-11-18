import { describe, expect, test } from 'vitest'
import { errorReference, newTraceId, traceIdFrom, traceparent } from './trace'

describe('trace context', () => {
  test('reads the trace id from a traceparent header', () => {
    expect(
      traceIdFrom('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'),
    ).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
  })

  test.each([
    undefined,
    '',
    'garbage',
    '00-00000000000000000000000000000000-00f067aa0ba902b7-01',
    '01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7',
  ])('ignores an invalid header %j', (header) => {
    expect(traceIdFrom(header)).toBeUndefined()
  })

  test('writes a header that reads back as the same trace', () => {
    const id = newTraceId()
    expect(id).toMatch(/^[0-9a-f]{32}$/)
    expect(traceIdFrom(traceparent(id))).toBe(id)
  })
})

describe('errorReference', () => {
  test('is undefined outside the browser', () => {
    expect(errorReference()).toBeUndefined()
  })
})
