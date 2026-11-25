// Editing a document (openspec: documents, "Editing a document"). Members are
// sent back to the details.
import {
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { DocumentForm } from '#/features/documents/DocumentForm'
import { getDocument } from '#/features/documents/functions'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/documents/$documentId/edit',
)({
  loader: async ({ params }) => {
    const result = await getDocument({
      data: { propertyId: params.propertyId, documentId: params.documentId },
    })
    if (!result.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    if (result.role !== 'owner') {
      throw redirect({
        to: '/properties/$propertyId/documents/$documentId',
        params,
      })
    }
    return result
  },
  head: () => ({ meta: [{ title: m.documents_page_title() }] }),
  component: EditDocumentRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_document_not_found_title()}
      text={m.reason_document_not_found()}
      backLabel={m.documents_back()}
    />
  ),
})

function EditDocumentRoute() {
  const { document, property, tenancies, today } = Route.useLoaderData()
  const router = useRouter()
  const toDetails = () =>
    router.navigate({
      to: '/properties/$propertyId/documents/$documentId',
      params: { propertyId: property.id, documentId: document.id },
    })
  return (
    <DocumentForm
      propertyId={property.id}
      streetAddress={property.streetAddress}
      tenancies={tenancies}
      today={today}
      editing={document}
      onClose={() => {
        void toDetails()
      }}
      onSaved={async () => {
        await router.invalidate()
        await toDetails()
      }}
    />
  )
}
