import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import {
  createFileRoute,
  createLink,
  notFound,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { NotFoundView } from '#/components/NotFoundView'
import { getTenancy } from '#/features/tenancies/functions'
import { depositStatus } from '#/features/deposits/deposit'
import { RemoveTenancyDialog } from '#/features/tenancies/RemoveTenancyDialog'
import { TenancyForm } from '#/features/tenancies/TenancyForm'
import { formatDate, formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'

const ButtonLink = createLink(Button)

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
  const { tenancy, property, today, rents, depositReturn } =
    Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  const toPage = () =>
    router.navigate({
      to: '/properties/$propertyId/tenancy',
      params: { propertyId },
    })
  const [removing, setRemoving] = useState(false)
  // An ended tenancy with a deposit: the return's status and its page.
  const state = depositStatus(tenancy, depositReturn, today)
  const statusText =
    state.kind === 'returned'
      ? state.kept > 0
        ? m.deposit_status_returned_kept({
            date: formatDate(state.on),
            amount: formatMoney(state.returned),
            kept: formatMoney(state.kept),
          })
        : m.deposit_status_returned({
            date: formatDate(state.on),
            amount: formatMoney(state.returned),
          })
      : m.deposit_status_pending()
  return (
    <>
      <TenancyForm
        propertyId={propertyId}
        address={property.streetAddress}
        editing={tenancy}
        startRent={rents.at(0)?.value}
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
        depositReturn={
          state.kind === 'returned' || state.kind === 'pending' ? (
            <Stack sx={{ gap: 0.75 }}>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                {statusText}
              </Typography>
              <ButtonLink
                to="/properties/$propertyId/tenancy/$tenancyId/deposit"
                params={{ propertyId, tenancyId: tenancy.id }}
                variant="outlined"
                sx={{ alignSelf: 'flex-start', minHeight: 44, px: 2 }}
              >
                {m.deposit_form_return_open()}
              </ButtonLink>
            </Stack>
          ) : undefined
        }
        rentChange={
          // Every tenancy's rent, not only the current one's (openspec:
          // tenancies, "Correcting a tenancy").
          <ButtonLink
            to="/properties/$propertyId/tenancy/$tenancyId/rent"
            params={{ propertyId, tenancyId: tenancy.id }}
            variant="outlined"
            sx={{ alignSelf: 'flex-start', minHeight: 44, px: 2 }}
          >
            {m.tenancy_form_change_rent()}
          </ButtonLink>
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
