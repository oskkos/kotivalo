import {
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getProperty } from '#/features/properties/functions'
import { getRecurringAmounts } from '#/features/recurring-amounts/functions'
import { TreatmentForm } from '#/features/recurring-amounts/TreatmentForm'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/amounts/treatment',
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
    if (view.role !== 'owner') {
      // Members see the treatment on the page; only owners change it.
      throw redirect({
        to: '/properties/$propertyId/amounts',
        params: { propertyId: params.propertyId },
      })
    }
    return { view, address: property.property.streetAddress }
  },
  head: () => ({
    meta: [
      {
        title: m.amounts_form_page_title({
          title: m.amounts_treatment_form_title(),
        }),
      },
    ],
  }),
  component: TreatmentRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function TreatmentRoute() {
  const { view, address } = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  const toPage = () =>
    router.navigate({
      to: '/properties/$propertyId/amounts',
      params: { propertyId },
    })
  return (
    <TreatmentForm
      propertyId={propertyId}
      view={view}
      address={address}
      onDone={() => router.invalidate().then(toPage)}
      onClose={() => {
        void toPage()
      }}
    />
  )
}
