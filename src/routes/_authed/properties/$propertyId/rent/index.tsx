import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { NotFoundView } from '#/components/NotFoundView'
import { getRentPayments } from '#/features/rent-payments/functions'
import { RentPaymentsPage } from '#/features/rent-payments/RentPaymentsPage'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/properties/$propertyId/rent/')({
  validateSearch: z.object({
    year: z.number().int().min(2000).max(2100).optional(),
  }),
  loader: async ({ params }) => {
    const view = await getRentPayments({
      data: { propertyId: params.propertyId },
    })
    if (!view.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return view
  },
  head: () => ({ meta: [{ title: m.rent_payments_page_title() }] }),
  component: RentPaymentsRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function RentPaymentsRoute() {
  const view = Route.useLoaderData()
  const { year } = Route.useSearch()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  return (
    <RentPaymentsPage
      view={view}
      propertyId={propertyId}
      address={view.property.streetAddress}
      year={year}
      onBack={() => {
        void router.navigate({
          to: '/properties/$propertyId/edit',
          params: { propertyId },
        })
      }}
      onYear={(chosen) => {
        void router.navigate({
          to: '/properties/$propertyId/rent',
          params: { propertyId },
          search: { year: chosen },
        })
      }}
    />
  )
}
