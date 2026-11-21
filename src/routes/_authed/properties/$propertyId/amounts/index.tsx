import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getProperty } from '#/features/properties/functions'
import { getRecurringAmounts } from '#/features/recurring-amounts/functions'
import { kindSlug } from '#/features/recurring-amounts/labels'
import { RecurringAmountsPage } from '#/features/recurring-amounts/RecurringAmountsPage'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/amounts/',
)({
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
  head: () => ({ meta: [{ title: m.amounts_page_title() }] }),
  component: RecurringAmountsRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function RecurringAmountsRoute() {
  const { view, address } = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  return (
    <RecurringAmountsPage
      view={view}
      address={address}
      onBack={() => {
        void router.navigate({
          to: '/properties/$propertyId/edit',
          params: { propertyId },
        })
      }}
      onEdit={(what) => {
        if (what === 'treatment') {
          void router.navigate({
            to: '/properties/$propertyId/amounts/treatment',
            params: { propertyId },
          })
        } else {
          void router.navigate({
            to: '/properties/$propertyId/amounts/$kind',
            params: { propertyId, kind: kindSlug(what) },
          })
        }
      }}
    />
  )
}
