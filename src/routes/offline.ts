// The offline page, fetched and kept by the service worker (public/sw.js).
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/offline')({
  server: {
    handlers: {
      // Imported on use, so the page's code stays out of the client bundle.
      GET: async () => {
        const { offlinePage } = await import('#/server/pwa/offline-page.server')
        return new Response(offlinePage(), {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-cache',
          },
        })
      },
    },
  },
})
