import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { NotFoundView } from '#/components/NotFoundView'
import { getProperty } from '#/features/properties/functions'
import { ChargesPage } from '#/features/recurring-amounts/ChargesPage'
import { getRecurringAmounts } from '#/features/recurring-amounts/functions'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/properties/$propertyId/charges')(
  {
    validateSearch: z.object({
      year: z.number().int().min(2000).max(2100).optional(),
    }),
    loader: async ({ params }) => {
      const [view, property] = await Promise.all([
        getRecurringAmounts({ data: { propertyId: params.propertyId } }),
        getProperty({ data: { id: params.propertyId } }),
      ])
      if (!view.ok || !property.ok) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
        throw notFound()
      }
      return { view, address: property.property.streetAddress }
    },
    head: () => ({ meta: [{ title: m.charges_page_title() }] }),
    component: ChargesRoute,
    notFoundComponent: () => (
      <NotFoundView
        title={m.reason_property_not_found_title()}
        text={m.reason_property_not_found()}
        backLabel={m.property_back_to_list()}
      />
    ),
  },
)

function ChargesRoute() {
  const { view, address } = Route.useLoaderData()
  const { year } = Route.useSearch()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  return (
    <ChargesPage
      view={{
        role: view.role,
        today: view.today,
        amounts: {
          maintenance: view.amounts.maintenance_charge,
          financing: view.financingCharges,
        },
        treatments: view.treatments,
      }}
      propertyId={propertyId}
      address={address}
      year={year}
      onBack={() => {
        void router.navigate({
          to: '/properties/$propertyId',
          params: { propertyId },
        })
      }}
      onYear={(chosen) => {
        void router.navigate({
          to: '/properties/$propertyId/charges',
          params: { propertyId },
          search: { year: chosen },
        })
      }}
    />
  )
}
