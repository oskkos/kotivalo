import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getTransaction } from '#/features/transactions/functions'
import { TransactionDetails } from '#/features/transactions/TransactionDetails'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/transactions/$transactionId',
)({
  loader: async ({ params }) => {
    const result = await getTransaction({
      data: {
        propertyId: params.propertyId,
        transactionId: params.transactionId,
      },
    })
    if (!result.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return result
  },
  head: () => ({ meta: [{ title: m.transactions_details_page_title() }] }),
  component: TransactionRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_transaction_not_found_title()}
      text={m.reason_transaction_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function TransactionRoute() {
  const { entry, property, role, loggedByYou } = Route.useLoaderData()
  const router = useRouter()
  return (
    <TransactionDetails
      entry={entry}
      property={property}
      role={role}
      loggedByYou={loggedByYou}
      onBack={() => {
        void router.navigate({
          to: '/properties/$propertyId/transactions',
          params: { propertyId: property.id },
          search: { year: Number(entry.date.slice(0, 4)) },
        })
      }}
    />
  )
}
