import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import {
  Link,
  createFileRoute,
  notFound,
  useRouter,
} from '@tanstack/react-router'
import { getProperty, updateProperty } from '#/features/properties/functions'
import { PropertyForm } from '#/features/properties/PropertyForm'
import { formatTenths } from '#/lib/format'
import { reasonText } from '#/lib/reasons'
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
    />
  )
}

/** The same for a flat that doesn't exist and one without access. */
function PropertyNotFound() {
  const { title, text } = reasonText('property_not_found')
  return (
    <Stack component="main" sx={{ gap: 1, px: 2.5, py: 6 }}>
      <Typography variant="h1">{title}</Typography>
      <Typography color="text.secondary">{text}</Typography>
      <Button
        component={Link}
        to="/"
        variant="outlined"
        sx={{ alignSelf: 'flex-start', mt: 2 }}
      >
        {m.property_back_to_list()}
      </Button>
    </Stack>
  )
}
