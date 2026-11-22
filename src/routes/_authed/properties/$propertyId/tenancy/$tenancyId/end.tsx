import {
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { EndTenancyForm } from '#/features/tenancies/EndTenancyForm'
import { getTenancy } from '#/features/tenancies/functions'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/tenancy/$tenancyId/end',
)({
  loader: async ({ params }) => {
    const result = await getTenancy({
      data: { propertyId: params.propertyId, tenancyId: params.tenancyId },
    })
    if (!result.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    if (result.role !== 'owner') {
      throw redirect({
        to: '/properties/$propertyId/tenancy',
        params: { propertyId: params.propertyId },
      })
    }
    return result
  },
  head: () => ({ meta: [{ title: m.tenancy_end_page_title() }] }),
  component: EndTenancyRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_tenancy_not_found_title()}
      text={m.reason_tenancy_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function EndTenancyRoute() {
  const { tenancy, property, today } = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  const toPage = () =>
    router.navigate({
      to: '/properties/$propertyId/tenancy',
      params: { propertyId },
    })
  return (
    <EndTenancyForm
      propertyId={propertyId}
      address={property.streetAddress}
      tenancy={tenancy}
      today={today}
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
