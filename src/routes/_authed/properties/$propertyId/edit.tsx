import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getProperty, updateProperty } from '#/features/properties/functions'
import { PropertyForm } from '#/features/properties/PropertyForm'
import { formatTenths } from '#/lib/format'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/properties/$propertyId/edit')({
  loader: async ({ params }) => {
    const result = await getProperty({ data: { id: params.propertyId } })
    if (!result.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return { property: result.property }
  },
  head: () => ({ meta: [{ title: m.property_edit_page_title() }] }),
  component: EditPropertyRoute,
  notFoundComponent: PropertyNotFound,
})

function EditPropertyRoute() {
  const { property } = Route.useLoaderData()
  const router = useRouter()
  const { id, floorArea, ...details } = property
  // Saving and closing return to the flat's details page.
  const toDetails = () => {
    void router.navigate({
      to: '/properties/$propertyId',
      params: { propertyId: id },
    })
  }
  return (
    <PropertyForm
      title={m.property_edit_title()}
      initial={{
        ...details,
        floorArea: formatTenths(floorArea),
        housingCompanyName: details.housingCompanyName ?? '',
        businessId: details.businessId ?? '',
        apartmentNumber: details.apartmentNumber ?? '',
      }}
      save={(changed) => updateProperty({ data: { id, ...changed } })}
      onSaved={() => {
        void router.invalidate().then(toDetails)
      }}
      onClose={toDetails}
    />
  )
}

/** The same for a flat that doesn't exist and one without access. */
function PropertyNotFound() {
  return (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  )
}
