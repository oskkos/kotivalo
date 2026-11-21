// Editing or deleting an entry (openspec: transactions, "Editing an entry",
// "Deleting an entry"). Members are sent back to the details.
import {
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getTransaction } from '#/features/transactions/functions'
import { TransactionForm } from '#/features/transactions/TransactionForm'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/transactions/$transactionId/edit',
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
    if (result.role !== 'owner') {
      throw redirect({
        to: '/properties/$propertyId/transactions/$transactionId',
        params,
      })
    }
    return result
  },
  head: () => ({ meta: [{ title: m.transactions_edit_page_title() }] }),
  component: EditTransactionRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_transaction_not_found_title()}
      text={m.reason_transaction_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function EditTransactionRoute() {
  const { entry, property, today } = Route.useLoaderData()
  const router = useRouter()
  const toList = async (year: number) => {
    await router.invalidate()
    await router.navigate({
      to: '/properties/$propertyId/transactions',
      params: { propertyId: property.id },
      search: { year },
    })
  }
  return (
    <TransactionForm
      flats={[property]}
      initialFlatId={property.id}
      pickFlat={false}
      today={today}
      editing={entry}
      onClose={() => {
        void router.navigate({
          to: '/properties/$propertyId/transactions/$transactionId',
          params: { propertyId: property.id, transactionId: entry.id },
        })
      }}
      onSaved={async () => {
        await router.invalidate()
        await router.navigate({
          to: '/properties/$propertyId/transactions/$transactionId',
          params: { propertyId: property.id, transactionId: entry.id },
        })
      }}
      onDeleted={() => toList(Number(entry.date.slice(0, 4)))}
    />
  )
}
