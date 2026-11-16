import { describe, expect, test } from 'vitest'
import { getRouter } from './router'

describe('Router', () => {
  test('registers the home route', () => {
    const router = getRouter()
    expect(router.routesById).toHaveProperty('/')
  })
})
