import IconButton from '@mui/material/IconButton'
import {
  createFileRoute,
  createLink,
  notFound,
  useRouter,
} from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getProperty, updateProperty } from '#/features/properties/functions'
import { PropertyForm } from '#/features/properties/PropertyForm'
import { getTenancies } from '#/features/tenancies/functions'
import { currentTenancy } from '#/features/tenancies/status'
import { TenancyCard } from '#/features/tenancies/TenancyCard'
import { formatTenths } from '#/lib/format'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/properties/$propertyId/edit')({
  loader: async ({ params }) => {
    const [result, tenancies] = await Promise.all([
      getProperty({ data: { id: params.propertyId } }),
      getTenancies({ data: { propertyId: params.propertyId } }),
    ])
    if (!result.ok || !tenancies.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return {
      property: result.property,
      tenancy: currentTenancy(tenancies.tenancies, tenancies.today),
    }
  },
  head: () => ({ meta: [{ title: m.property_edit_page_title() }] }),
  component: EditPropertyRoute,
  notFoundComponent: PropertyNotFound,
})

function EditPropertyRoute() {
  const { property, tenancy } = Route.useLoaderData()
  const router = useRouter()
  const toList = () => {
    void router.navigate({ to: '/' })
  }
  const { id, floorArea, ...details } = property
  return (
    <PropertyForm
      title={m.property_edit_title()}
      initial={{ ...details, floorArea: formatTenths(floorArea) }}
      save={(changed) => updateProperty({ data: { id, ...changed } })}
      onSaved={() => {
        void router.invalidate().then(toList)
      }}
      onClose={toList}
      aboveForm={<TenancyCard propertyId={property.id} tenancy={tenancy} />}
      headerAction={
        <>
          <IconLink
            to="/properties/$propertyId/transactions"
            params={{ propertyId: id }}
            aria-label={m.transactions_title()}
          >
            <ReceiptIcon />
          </IconLink>
          <IconLink
            to="/properties/$propertyId/amounts"
            params={{ propertyId: id }}
            aria-label={m.amounts_title()}
          >
            <EuroIcon />
          </IconLink>
          <IconLink
            to="/properties/$propertyId/sharing"
            params={{ propertyId: id }}
            aria-label={m.ownership_title()}
          >
            <PeopleIcon />
          </IconLink>
        </>
      }
    />
  )
}

const IconLink = createLink(IconButton)

function ReceiptIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3 H18 V21 L15 19 L12 21 L9 19 L6 21 Z" />
      <path d="M9 8 H15 M9 12 H15 M9 16 H12" />
    </svg>
  )
}

function EuroIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.5 6.5 A7 7 0 1 0 17.5 17.5" />
      <path d="M4 10 H13 M4 14 H13" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20 a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6 a3.5 3.5 0 0 1 0 6.8 M18 14 a6.5 6.5 0 0 1 3.5 6" />
    </svg>
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
