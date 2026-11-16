import { env } from 'cloudflare:workers'
import { describe, expect, test } from 'vitest'

// Harness check: proves *.server.test.ts files run inside workerd with the
// bindings from wrangler.jsonc, not in Node.
describe('Workers test runtime', () => {
  test('runs in the Workers runtime', () => {
    expect(navigator.userAgent).toBe('Cloudflare-Workers')
  })

  test('exposes the env from wrangler.jsonc', () => {
    expect(env).toBeTypeOf('object')
  })
})
