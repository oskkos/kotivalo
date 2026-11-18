// The Worker's server entry: TanStack Start's handler wrapped in Paraglide's
// middleware, which resolves the request's language (project.inlang/
// paraglide.config.ts) so getLocale() and messages use it during SSR, and in
// the request's trace, which logs it (platform/request.server.ts).
import handler from '@tanstack/react-start/server-entry'
import { paraglideMiddleware } from './paraglide/server.js'
import { handleTraced } from './server/platform/request.server'

export default {
  fetch(request: Request): Promise<Response> {
    return handleTraced(request, () =>
      paraglideMiddleware(request, () => handler.fetch(request)),
    )
  },
}
