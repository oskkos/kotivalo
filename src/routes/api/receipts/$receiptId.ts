// A receipt file, after the access check in receipt-response.server.ts.
// `?download=1` sends it as an attachment.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/receipts/$receiptId')({
  server: {
    handlers: {
      // Imported on use: the modules need the Workers runtime, and the route
      // tree is also loaded where there is none (unit tests, the client).
      GET: async ({ request, params }) => {
        const [
          { receiptResponse },
          { transactionRepository },
          { sharingRepository },
          { getRequestContext },
        ] = await Promise.all([
          import('#/features/transactions/receipt-response.server'),
          import('#/features/transactions/transaction.repository.server'),
          import('#/features/sharing/sharing.repository.server'),
          import('#/server/platform/context.server'),
        ])
        const context = getRequestContext()
        const session = await context.auth.getSession()
        return receiptResponse(
          {
            userId: session?.user.id,
            transactions: transactionRepository(context.db),
            sharing: sharingRepository(context.db),
            storage: context.storage,
          },
          params.receiptId,
          { download: new URL(request.url).searchParams.has('download') },
        )
      },
    },
  },
})
