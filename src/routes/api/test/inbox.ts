// Test-only: see src/server/platform/test-inbox.server.ts.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/test/inbox')({
  server: {
    handlers: {
      // Imported on use: the module needs the Workers runtime, and the route
      // tree is also loaded where there is none (unit tests, the client).
      GET: async ({ request }) => {
        const { testInboxResponse } =
          await import('#/server/platform/test-inbox.server')
        return testInboxResponse(request)
      },
    },
  },
})
