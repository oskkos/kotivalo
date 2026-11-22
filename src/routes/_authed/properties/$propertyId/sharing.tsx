import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getOwnership } from '#/features/ownership/functions'
import { getSharing } from '#/features/sharing/functions'
import { SharingPage } from '#/features/sharing/SharingPage'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/properties/$propertyId/sharing')(
  {
    loader: async ({ params }) => {
      const data = { propertyId: params.propertyId }
      const [view, ownership] = await Promise.all([
        getSharing({ data }),
        getOwnership({ data }),
      ])
      if (!view.ok || !ownership.ok) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
        throw notFound()
      }
      return { view, ownership }
    },
    head: () => ({ meta: [{ title: m.ownership_page_title() }] }),
    component: SharingRoute,
    notFoundComponent: () => (
      <NotFoundView
        title={m.reason_property_not_found_title()}
        text={m.reason_property_not_found()}
        backLabel={m.property_back_to_list()}
      />
    ),
  },
)

function SharingRoute() {
  const { view, ownership } = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  return (
    <SharingPage
      view={view}
      ownership={ownership}
      onChanged={() => router.invalidate()}
      onLeft={() => {
        void router.invalidate().then(() => router.navigate({ to: '/' }))
      }}
      onBack={() => {
        void router.navigate({
          to: '/properties/$propertyId',
          params: { propertyId },
        })
      }}
    />
  )
}
