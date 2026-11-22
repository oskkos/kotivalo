import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { NotFoundView } from '#/components/NotFoundView'
import { getRentMonth } from '#/features/rent-payments/functions'
import { RentMonthPage } from '#/features/rent-payments/RentMonthPage'
import { MONTH } from '#/features/rent-payments/schemas'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/rent/$tenancyId/$month',
)({
  // The year of the rent payments page the month was opened from, if any.
  validateSearch: z.object({
    year: z.number().int().min(2000).max(2100).optional(),
  }),
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
  const { year } = Route.useSearch()
  const router = useRouter()
  return (
    <RentMonthPage
      view={view}
      propertyId={propertyId}
      address={view.property.streetAddress}
      backTo={year === undefined ? 'flat' : 'payments'}
      onBack={() => {
        void (year === undefined
          ? router.navigate({
              to: '/properties/$propertyId',
              params: { propertyId },
            })
          : router.navigate({
              to: '/properties/$propertyId/rent',
              params: { propertyId },
              search: { year },
            }))
      }}
      onChanged={() => router.invalidate()}
    />
  )
}
