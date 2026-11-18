// A test "browser" for Auth in Workers tests: an Auth on the test database
// whose cookies persist between calls, like a browser's cookie jar.
import type { Auth } from '#/server/auth/auth'
import { createAuth } from '#/server/platform/auth.server'
import type { Db } from '#/server/platform/db.server'

export interface TestBrowser {
  auth: Auth
  /** The cookies the browser would send, by name. */
  jar: Map<string, string>
}

export function testBrowser(db: Db): TestBrowser {
  const jar = new Map<string, string>()
  const auth = createAuth({
    db,
    secret: 'test-secret-that-is-at-least-32-characters-long',
    baseURL: 'http://localhost:3000',
    headers: () =>
      new Headers(
        jar.size === 0
          ? {}
          : { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
      ),
    onResponseHeaders: (headers) => {
      for (const cookie of headers.getSetCookie()) {
        const [pair = '', ...attributes] = cookie.split(';')
        const [name = '', ...value] = pair.trim().split('=')
        const cleared = attributes.some((a) => /^\s*max-age=0\s*$/i.test(a))
        if (cleared || value.join('=') === '') {
          jar.delete(name)
        } else {
          jar.set(name, value.join('='))
        }
      }
    },
  })
  return { auth, jar }
}
