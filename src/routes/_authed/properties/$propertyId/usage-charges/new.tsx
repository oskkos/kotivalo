import {
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getUsageCharges } from '#/features/usage-charges/functions'
import { occupantsOn } from '#/features/usage-charges/months'
import { UsageChargeForm } from '#/features/usage-charges/UsageChargeForm'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/usage-charges/new',
)({
  loader: async ({ params }) => {
    const view = await getUsageCharges({
      data: { propertyId: params.propertyId },
    })
    if (!view.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    if (view.role !== 'owner') {
      throw redirect({
        to: '/properties/$propertyId/usage-charges',
        params: { propertyId: params.propertyId },
      })
    }
    return view
  },
  head: () => ({
    meta: [
      { title: m.amounts_form_page_title({ title: m.usage_charges_add() }) },
    ],
  }),
  component: NewUsageChargeRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function NewUsageChargeRoute() {
  const view = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  const toPage = () =>
    router.navigate({
      to: '/properties/$propertyId/usage-charges',
      params: { propertyId },
    })
  return (
    <UsageChargeForm
      propertyId={propertyId}
      address={view.property.streetAddress}
      persons={occupantsOn(view.tenancies, view.today)}
      onDone={async () => {
        await router.invalidate()
        await toPage()
      }}
      onClose={() => {
        void toPage()
      }}
    />
  )
}
