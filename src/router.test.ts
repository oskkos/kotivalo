import { describe, expect, test, vi } from 'vitest'
import { getRouter } from './router'

// Server functions need the build's server/client split, which plain Vitest
// doesn't do; the route tree only needs them to exist.
vi.mock('#/features/authentication/functions', () => ({}))

describe('Router', () => {
  test('registers the home route', () => {
    const router = getRouter()
    expect(router.routesById).toHaveProperty('/')
  })

  test('registers the sign-in route', () => {
    expect(getRouter().routesById).toHaveProperty('/sign-in')
  })
})
