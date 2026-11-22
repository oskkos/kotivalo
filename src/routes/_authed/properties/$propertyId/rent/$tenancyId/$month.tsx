import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getRentMonth } from '#/features/rent-payments/functions'
import { RentMonthPage } from '#/features/rent-payments/RentMonthPage'
import { MONTH } from '#/features/rent-payments/schemas'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/rent/$tenancyId/$month',
)({
  loader: async ({ params }) => {
    if (!MONTH.test(params.month)) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    const view = await getRentMonth({
      data: {
        propertyId: params.propertyId,
        tenancyId: params.tenancyId,
        month: params.month,
      },
    })
    if (!view.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return view
  },
  head: () => ({ meta: [{ title: m.rent_month_page_title() }] }),
  component: RentMonthRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function RentMonthRoute() {
  const view = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  return (
    <RentMonthPage
      view={view}
      propertyId={propertyId}
      address={view.property.streetAddress}
      onBack={() => {
        void router.navigate({
          to: '/properties/$propertyId',
          params: { propertyId },
        })
      }}
      onChanged={() => router.invalidate()}
    />
  )
}
