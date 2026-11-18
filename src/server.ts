// The Worker's server entry: TanStack Start's handler wrapped in Paraglide's
// middleware, which resolves the request's language (project.inlang/
// paraglide.config.ts) so getLocale() and messages use it during SSR. Server
// errors are logged here as a last resort (src/server/log/log.ts).
import handler from '@tanstack/react-start/server-entry'
import { paraglideMiddleware } from './paraglide/server.js'
import { createLogger } from './server/platform/logger.server'

export default {
  async fetch(request: Request): Promise<Response> {
    const log = createLogger()
    const { pathname } = new URL(request.url)
    try {
      const response = await paraglideMiddleware(request, () =>
        handler.fetch(request),
      )
      if (response.status >= 500) {
        log.error('http.server_error', {
          method: request.method,
          path: pathname,
          status: response.status,
        })
      }
      return response
    } catch (error) {
      log.error(
        'http.unhandled_error',
        { method: request.method, path: pathname },
        error,
      )
      return new Response('Internal Server Error', { status: 500 })
    }
  },
}
