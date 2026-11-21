import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { NotFoundView } from '#/components/NotFoundView'
import { getTransactions } from '#/features/transactions/functions'
import { TransactionsPage } from '#/features/transactions/TransactionsPage'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/transactions/',
)({
  validateSearch: z.object({
    year: z.number().int().min(2000).max(2100).optional(),
  }),
  loaderDeps: ({ search }) => ({ year: search.year }),
  loader: async ({ params, deps }) => {
    const view = await getTransactions({
      data: { propertyId: params.propertyId, year: deps.year },
    })
    if (!view.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return { view }
  },
  head: () => ({ meta: [{ title: m.transactions_page_title() }] }),
  component: TransactionsRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function TransactionsRoute() {
  const { view } = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  return (
    <TransactionsPage
      view={view}
      onBack={() => {
        void router.navigate({
          to: '/properties/$propertyId/edit',
          params: { propertyId },
        })
      }}
      onYear={(year) => {
        void router.navigate({
          to: '/properties/$propertyId/transactions',
          params: { propertyId },
          search: { year },
        })
      }}
    />
  )
}
