import { describe, expect, test, vi } from 'vitest'
import { getRouter } from './router'

// Server functions need the build's server/client split, which plain Vitest
// doesn't do; the route tree only needs them to exist.
vi.mock('#/features/authentication/functions', () => ({}))

describe('Router', () => {
  test('registers the home and sign-in pages', () => {
    const { routesByPath } = getRouter()
    expect(routesByPath).toHaveProperty('/')
    expect(routesByPath).toHaveProperty('/sign-in')
  })

  test('puts the home page behind the signed-in layout', () => {
    expect(getRouter().routesById).toHaveProperty('/_authed/')
  })
})
