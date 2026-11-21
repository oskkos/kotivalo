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
import { formatTenths } from '#/lib/format'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/properties/$propertyId/edit')({
  loader: async ({ params }) => {
    const result = await getProperty({ data: { id: params.propertyId } })
    if (!result.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return result.property
  },
  head: () => ({ meta: [{ title: m.property_edit_page_title() }] }),
  component: EditPropertyRoute,
  notFoundComponent: PropertyNotFound,
})

function EditPropertyRoute() {
  const property = Route.useLoaderData()
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
      headerAction={
        <>
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
