import {
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { NotFoundView } from '#/components/NotFoundView'
import { getTenancy } from '#/features/tenancies/functions'
import { RemoveTenancyDialog } from '#/features/tenancies/RemoveTenancyDialog'
import { TenancyForm } from '#/features/tenancies/TenancyForm'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/tenancy/$tenancyId/edit',
)({
  loader: async ({ params }) => {
    const result = await getTenancy({
      data: { propertyId: params.propertyId, tenancyId: params.tenancyId },
    })
    if (!result.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    if (result.role !== 'owner') {
      throw redirect({
        to: '/properties/$propertyId/tenancy',
        params: { propertyId: params.propertyId },
      })
    }
    return result
  },
  head: () => ({ meta: [{ title: m.tenancy_form_page_title() }] }),
  component: EditTenancyRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_tenancy_not_found_title()}
      text={m.reason_tenancy_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function EditTenancyRoute() {
  const { tenancy, property, today } = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  const toPage = () =>
    router.navigate({
      to: '/properties/$propertyId/tenancy',
      params: { propertyId },
    })
  const [removing, setRemoving] = useState(false)
  return (
    <>
      <TenancyForm
        propertyId={propertyId}
        address={property.streetAddress}
        editing={tenancy}
        onSaved={async () => {
          await router.invalidate()
          await toPage()
        }}
        onClose={() => {
          void toPage()
        }}
        onRemove={
          // Only before its start day (openspec: tenancies, "Removing a
          // tenancy that hasn't started").
          tenancy.validFrom > today
            ? () => {
                setRemoving(true)
              }
            : undefined
        }
      />
      {removing ? (
        <RemoveTenancyDialog
          propertyId={propertyId}
          tenancy={tenancy}
          open
          onClose={() => {
            setRemoving(false)
          }}
          onDone={async () => {
            await router.invalidate()
            await toPage()
          }}
        />
      ) : null}
    </>
  )
}
