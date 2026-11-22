import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getTenancies } from '#/features/tenancies/functions'
import { TenancyPage } from '#/features/tenancies/TenancyPage'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/tenancy/',
)({
  loader: async ({ params }) => {
    const view = await getTenancies({ data: { propertyId: params.propertyId } })
    if (!view.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return view
  },
  head: () => ({ meta: [{ title: m.tenancy_page_title() }] }),
  component: TenancyRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function TenancyRoute() {
  const view = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  return (
    <TenancyPage
      view={view}
      address={view.property.streetAddress}
      onBack={() => {
        void router.navigate({
          to: '/properties/$propertyId/edit',
          params: { propertyId },
        })
      }}
    />
  )
}
