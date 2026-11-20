import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getSharing } from '#/features/sharing/functions'
import { SharingPage } from '#/features/sharing/SharingPage'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/properties/$propertyId/sharing')(
  {
    loader: async ({ params }) => {
      const result = await getSharing({
        data: { propertyId: params.propertyId },
      })
      if (!result.ok) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
        throw notFound()
      }
      return result
    },
    head: () => ({ meta: [{ title: m.sharing_page_title() }] }),
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
  const view = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  return (
    <SharingPage
      view={view}
      onChanged={() => router.invalidate()}
      onLeft={() => {
        void router.invalidate().then(() => router.navigate({ to: '/' }))
      }}
      onBack={() => {
        void router.navigate({
          to: '/properties/$propertyId/edit',
          params: { propertyId },
        })
      }}
    />
  )
}
