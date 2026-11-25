import Button from '@mui/material/Button'
import {
  createFileRoute,
  createLink,
  notFound,
  useRouter,
} from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getDocument } from '#/features/documents/functions'
import { DocumentDetails } from '#/features/documents/DocumentDetails'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/documents/$documentId/',
)({
  loader: async ({ params }) => {
    const result = await getDocument({
      data: { propertyId: params.propertyId, documentId: params.documentId },
    })
    if (!result.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return result
  },
  head: () => ({ meta: [{ title: m.documents_page_title() }] }),
  component: DocumentRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_document_not_found_title()}
      text={m.reason_document_not_found()}
      backLabel={m.documents_back()}
    />
  ),
})

const ButtonLink = createLink(Button)

function DocumentRoute() {
  const { document, property, role, addedByYou } = Route.useLoaderData()
  const router = useRouter()
  const toList = async () => {
    await router.invalidate()
    await router.navigate({
      to: '/properties/$propertyId/documents',
      params: { propertyId: property.id },
    })
  }
  return (
    <DocumentDetails
      document={document}
      property={property}
      role={role}
      addedByYou={addedByYou}
      editAction={
        <ButtonLink
          to="/properties/$propertyId/documents/$documentId/edit"
          params={{ propertyId: property.id, documentId: document.id }}
          variant="contained"
          sx={{ minHeight: 52, borderRadius: 999 }}
        >
          {m.documents_edit()}
        </ButtonLink>
      }
      onBack={() => {
        void router.navigate({
          to: '/properties/$propertyId/documents',
          params: { propertyId: property.id },
        })
      }}
      onDeleted={toList}
    />
  )
}
