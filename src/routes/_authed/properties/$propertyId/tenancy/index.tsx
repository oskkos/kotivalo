import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import {
  createFileRoute,
  createLink,
  notFound,
  useRouter,
} from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getTenancies } from '#/features/tenancies/functions'
import { tenancyStatus } from '#/features/tenancies/status'
import { TenancyPage } from '#/features/tenancies/TenancyPage'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/tenancy/',
)({
  loader: async ({ params }) => {
    const view = await getTenancies({ data: { propertyId: params.propertyId } })
    if (!view.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return view
  },
  head: () => ({ meta: [{ title: m.tenancy_page_title() }] }),
  component: TenancyRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

const ButtonLink = createLink(Button)

function TenancyRoute() {
  const view = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  return (
    <TenancyPage
      view={view}
      address={view.property.streetAddress}
      onBack={() => {
        void router.navigate({
          to: '/properties/$propertyId/edit',
          params: { propertyId },
        })
      }}
      addAction={
        <ButtonLink
          to="/properties/$propertyId/tenancy/new"
          params={{ propertyId }}
          sx={{ minHeight: 48, px: 2.5 }}
        >
          {m.tenancy_add()}
        </ButtonLink>
      }
      currentActions={(tenancy) => (
        <Stack sx={{ gap: 1 }}>
          <ButtonLink
            to="/properties/$propertyId/tenancy/$tenancyId/edit"
            params={{ propertyId, tenancyId: tenancy.id }}
            variant="outlined"
            aria-label={m.tenancy_edit_label()}
            sx={{ minHeight: 48 }}
          >
            {m.tenancy_edit()}
          </ButtonLink>
          {tenancyStatus(tenancy, view.today).kind === 'notice_given' ? (
            <ButtonLink
              to="/properties/$propertyId/tenancy/new"
              params={{ propertyId }}
              sx={{ minHeight: 48 }}
            >
              {m.tenancy_add_next()}
            </ButtonLink>
          ) : null}
        </Stack>
      )}
    />
  )
}
