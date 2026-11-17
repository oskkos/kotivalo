// The Worker's server entry: TanStack Start's handler wrapped in Paraglide's
// middleware, which resolves the request's language (project.inlang/
// paraglide.config.ts) so getLocale() and messages use it during SSR.
import handler from '@tanstack/react-start/server-entry'
import { paraglideMiddleware } from './paraglide/server.js'

export default {
  fetch(request: Request): Promise<Response> {
    return paraglideMiddleware(request, () => handler.fetch(request))
  },
}
