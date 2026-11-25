import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { NotFoundView } from '#/components/NotFoundView'
import { getUsageCharges } from '#/features/usage-charges/functions'
import { UsageChargesByMonthPage } from '#/features/usage-charges/UsageChargesByMonthPage'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/usage-charges/months',
)({
  validateSearch: z.object({
    year: z.number().int().min(2000).max(2100).optional(),
  }),
  loader: async ({ params }) => {
    const view = await getUsageCharges({
      data: { propertyId: params.propertyId },
    })
    if (!view.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return view
  },
  head: () => ({ meta: [{ title: m.usage_charges_months_page_title() }] }),
  component: UsageChargesByMonthRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function UsageChargesByMonthRoute() {
  const view = Route.useLoaderData()
  const { year } = Route.useSearch()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  return (
    <UsageChargesByMonthPage
      view={view}
      propertyId={propertyId}
      address={view.property.streetAddress}
      year={year}
      onBack={() => {
        void router.navigate({
          to: '/properties/$propertyId',
          params: { propertyId },
        })
      }}
      onYear={(chosen) => {
        void router.navigate({
          to: '/properties/$propertyId/usage-charges/months',
          params: { propertyId },
          search: { year: chosen },
        })
      }}
    />
  )
}
