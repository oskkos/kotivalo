import {
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getNewTenancyOptions } from '#/features/tenancies/functions'
import { TenancyForm } from '#/features/tenancies/TenancyForm'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/tenancy/new',
)({
  loader: async ({ params }) => {
    const options = await getNewTenancyOptions({
      data: { propertyId: params.propertyId },
    })
    if (!options.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    if (options.role !== 'owner') {
      throw redirect({
        to: '/properties/$propertyId/tenancy',
        params: { propertyId: params.propertyId },
      })
    }
    return options
  },
  head: () => ({ meta: [{ title: m.tenancy_form_page_title() }] }),
  component: NewTenancyRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function NewTenancyRoute() {
  const options = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  const toPage = () =>
    router.navigate({
      to: '/properties/$propertyId/tenancy',
      params: { propertyId },
    })
  return (
    <TenancyForm
      propertyId={propertyId}
      address={options.property.streetAddress}
      tenancyRents={options.tenancyRents}
      tenancies={options.tenancies}
      tenancyFees={options.tenancyFees}
      today={options.today}
      onSaved={async () => {
        await router.invalidate()
        await toPage()
      }}
      onClose={() => {
        void toPage()
      }}
    />
  )
}
