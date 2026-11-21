import { describe, expect, test, vi } from 'vitest'
import { getRouter } from './router'

// Server functions need the build's server/client split, which plain Vitest
// doesn't do; the route tree only needs them to exist.
vi.mock('#/features/authentication/functions', () => ({}))
vi.mock('#/features/properties/functions', () => ({}))
vi.mock('#/features/sharing/functions', () => ({}))
vi.mock('#/features/ownership/functions', () => ({}))
vi.mock('#/features/account/functions', () => ({}))
vi.mock('#/features/recurring-amounts/functions', () => ({}))
vi.mock('#/features/transactions/functions', () => ({}))

describe('Router', () => {
  test('registers the home and sign-in pages', () => {
    const { routesByPath } = getRouter()
    expect(routesByPath).toHaveProperty('/')
    expect(routesByPath).toHaveProperty('/sign-in')
  })

  test('puts the home page behind the signed-in layout', () => {
    expect(getRouter().routesById).toHaveProperty('/_authed/')
  })

  test('registers the new and edit flat pages behind the signed-in layout', () => {
    const { routesById } = getRouter()
    expect(routesById).toHaveProperty('/_authed/properties/new')
    expect(routesById).toHaveProperty('/_authed/properties/$propertyId/edit')
  })

  test('registers the account page behind the signed-in layout', () => {
    expect(getRouter().routesById).toHaveProperty('/_authed/account')
  })

  test('registers the rent and charges page behind the signed-in layout', () => {
    expect(getRouter().routesById).toHaveProperty(
      '/_authed/properties/$propertyId/amounts/',
    )
  })
})
