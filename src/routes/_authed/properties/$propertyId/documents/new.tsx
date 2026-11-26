// The add document form (openspec: documents, "Adding a document"). Members
// are sent back to the documents page.
import {
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { z } from 'zod'
import { NotFoundView } from '#/components/NotFoundView'
import { DocumentForm } from '#/features/documents/DocumentForm'
import { getNewDocument } from '#/features/documents/functions'
import { DOCUMENT_KINDS } from '#/features/documents/kinds'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/documents/new',
)({
  // A lease's kind and tenancy from the Tenancy page; anything else is
  // ignored (openspec: documents, "Adding a document").
  validateSearch: z.object({
    kind: z.enum(DOCUMENT_KINDS).optional().catch(undefined),
    tenancyId: z.string().max(64).optional().catch(undefined),
  }),
  loader: async ({ params }) => {
    const result = await getNewDocument({
      data: { propertyId: params.propertyId },
    })
    if (!result.ok) {
      if (result.reason === 'sharing_owner_only') {
        throw redirect({
          to: '/properties/$propertyId/documents',
          params: { propertyId: params.propertyId },
        })
      }
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return result
  },
  head: () => ({ meta: [{ title: m.documents_page_title() }] }),
  component: NewDocumentRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function NewDocumentRoute() {
  const { property, tenancies, today } = Route.useLoaderData()
  const router = useRouter()
  const search = Route.useSearch()
  // Only the flat's own tenancy is preselected.
  const tenancyId = tenancies.some((t) => t.id === search.tenancyId)
    ? search.tenancyId
    : undefined
  return (
    <DocumentForm
      propertyId={property.id}
      streetAddress={property.streetAddress}
      tenancies={tenancies}
      today={today}
      defaultKind={search.kind}
      defaultTenancyId={tenancyId}
      onClose={() => {
        // Opened from the Tenancy page's lease card, back to it.
        void router.navigate(
          tenancyId === undefined
            ? {
                to: '/properties/$propertyId/documents',
                params: { propertyId: property.id },
              }
            : {
                to: '/properties/$propertyId/tenancy',
                params: { propertyId: property.id },
              },
        )
      }}
      onSaved={async (documentId) => {
        await router.invalidate()
        await router.navigate({
          to: '/properties/$propertyId/documents/$documentId',
          params: { propertyId: property.id, documentId },
        })
      }}
    />
  )
}
