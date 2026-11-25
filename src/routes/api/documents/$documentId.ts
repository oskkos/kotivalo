// A document file, after the access check in receipt-response.server.ts.
// `?download=1` sends it as an attachment.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/documents/$documentId')({
  server: {
    handlers: {
      // Imported on use: the modules need the Workers runtime, and the route
      // tree is also loaded where there is none (unit tests, the client).
      GET: async ({ request, params }) => {
        const [
          { documentResponse },
          { documentRepository },
          { sharingRepository },
          { getRequestContext },
        ] = await Promise.all([
          import('#/features/documents/document-response.server'),
          import('#/features/documents/document.repository.server'),
          import('#/features/sharing/sharing.repository.server'),
          import('#/server/platform/context.server'),
        ])
        const context = getRequestContext()
        const session = await context.auth.getSession()
        return documentResponse(
          {
            userId: session?.user.id,
            documents: documentRepository(context.db),
            sharing: sharingRepository(context.db),
            storage: context.storage,
          },
          params.documentId,
          { download: new URL(request.url).searchParams.has('download') },
        )
      },
    },
  },
})
