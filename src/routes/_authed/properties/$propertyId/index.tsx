import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { FlatDetailsPage } from '#/features/properties/FlatDetailsPage'
import { getFlatDetails } from '#/features/properties/functions'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/properties/$propertyId/')({
  loader: async ({ params }) => {
    const view = await getFlatDetails({ data: { id: params.propertyId } })
    if (!view.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return view
  },
  head: () => ({ meta: [{ title: m.flat_details_page_title() }] }),
  component: FlatDetailsRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function FlatDetailsRoute() {
  const view = Route.useLoaderData()
  const router = useRouter()
  return <FlatDetailsPage view={view} onChanged={() => router.invalidate()} />
}
