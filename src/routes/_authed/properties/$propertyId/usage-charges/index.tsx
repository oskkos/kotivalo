import Button from '@mui/material/Button'
import {
  createFileRoute,
  createLink,
  notFound,
  useRouter,
} from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getUsageCharges } from '#/features/usage-charges/functions'
import { UsageChargesPage } from '#/features/usage-charges/UsageChargesPage'
import { chargeName } from '#/lib/charge-labels'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/usage-charges/',
)({
  loader: async ({ params }) => {
    const view = await getUsageCharges({
      data: { propertyId: params.propertyId },
    })
    if (!view.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return view
  },
  head: () => ({ meta: [{ title: m.usage_charges_page_title() }] }),
  component: UsageChargesRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

const ButtonLink = createLink(Button)

function UsageChargesRoute() {
  const view = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  return (
    <UsageChargesPage
      view={view}
      address={view.property.streetAddress}
      onBack={() => {
        void router.navigate({
          to: '/properties/$propertyId',
          params: { propertyId },
        })
      }}
      add={
        <ButtonLink
          to="/properties/$propertyId/usage-charges/new"
          params={{ propertyId }}
          sx={{ minHeight: 48 }}
        >
          {m.usage_charges_add()}
        </ButtonLink>
      }
      change={(charge) => (
        <ButtonLink
          to="/properties/$propertyId/usage-charges/$usageChargeId"
          params={{ propertyId, usageChargeId: charge.id }}
          variant="outlined"
          aria-label={m.usage_charge_change_label({ name: chargeName(charge) })}
          sx={{ minHeight: 44, px: 2, flexShrink: 0 }}
        >
          {m.amounts_change()}
        </ButtonLink>
      )}
    />
  )
}
