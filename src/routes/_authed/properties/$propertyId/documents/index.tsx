import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getDocuments } from '#/features/documents/functions'
import { DocumentsPage } from '#/features/documents/DocumentsPage'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/documents/',
)({
  loader: async ({ params }) => {
    const view = await getDocuments({ data: { propertyId: params.propertyId } })
    if (!view.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return { view }
  },
  head: () => ({ meta: [{ title: m.documents_page_title() }] }),
  component: DocumentsRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function DocumentsRoute() {
  const { view } = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  return (
    <DocumentsPage
      view={view}
      onBack={() => {
        void router.navigate({
          to: '/properties/$propertyId',
          params: { propertyId },
        })
      }}
    />
  )
}
