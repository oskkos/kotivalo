// Browser log lines; see src/server/platform/client-log.server.ts.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/log')({
  server: {
    handlers: {
      // Imported on use: the modules need the Workers runtime, and the route
      // tree is also loaded where there is none (unit tests, the client).
      POST: async ({ request }) => {
        const [{ clientLogResponse }, { getRequestContext }, { consumeLimit }] =
          await Promise.all([
            import('#/server/platform/client-log.server'),
            import('#/server/platform/context.server'),
            import('#/server/platform/limits.server'),
          ])
        const context = getRequestContext()
        return clientLogResponse(request, {
          log: context.log,
          clientIp: context.clientIp(),
          consumeLimit: (key, rule) => consumeLimit(context.db, key, rule),
          userId: async () => (await context.auth.getSession())?.user.id,
        })
      },
    },
  },
})
