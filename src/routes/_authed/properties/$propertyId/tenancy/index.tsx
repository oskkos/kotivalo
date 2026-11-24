import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import {
  createFileRoute,
  createLink,
  notFound,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { NotFoundView } from '#/components/NotFoundView'
import { UndoDialog } from '#/features/recurring-amounts/UndoDialog'
import {
  getTenancies,
  undoTenancyOccupants,
  undoTenancyRent,
} from '#/features/tenancies/functions'
import { OccupantsDialog } from '#/features/tenancies/OccupantsDialog'
import { CancelEndingDialog } from '#/features/tenancies/CancelEndingDialog'
import { tenancyStatus } from '#/features/tenancies/status'
import type { Tenancy } from '#/features/tenancies/tenancy.repository.server'
import { TenancyPage } from '#/features/tenancies/TenancyPage'
import { formatDate, formatMoney } from '#/lib/format'
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
const TextLink = createLink(Link)

function TenancyRoute() {
  const view = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  const [cancelling, setCancelling] = useState<Tenancy>()
  const [undoingRent, setUndoingRent] = useState<Tenancy>()
  const [changingOccupants, setChangingOccupants] = useState<Tenancy>()
  const [undoingOccupants, setUndoingOccupants] = useState<Tenancy>()
  const undoPeriods = undoingOccupants
    ? (view.occupants[undoingOccupants.id] ?? [])
    : []
  const latestOccupants = undoPeriods.at(-1)
  const previousOccupants = undoPeriods.at(-2)
  const undoRents = undoingRent ? (view.rents[undoingRent.id] ?? []) : []
  const latestRent = undoRents.at(-1)
  const previousRent = undoRents.at(-2)
  return (
    <>
      <TenancyPage
        view={view}
        address={view.property.streetAddress}
        onBack={() => {
          void router.navigate({
            to: '/properties/$propertyId',
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
        otherRow={(tenancy, row) => (
          <TextLink
            to="/properties/$propertyId/tenancy/$tenancyId/edit"
            params={{ propertyId, tenancyId: tenancy.id }}
            underline="none"
            color="inherit"
            sx={{ display: 'block' }}
          >
            {row}
          </TextLink>
        )}
        earlierAction={
          <TextLink
            to="/properties/$propertyId/tenancy/new"
            params={{ propertyId }}
            sx={{
              alignSelf: 'center',
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
              fontWeight: 800,
            }}
          >
            {m.tenancy_add_earlier()}
          </TextLink>
        }
        rentChange={(tenancy) => (
          <ButtonLink
            to="/properties/$propertyId/tenancy/$tenancyId/rent"
            params={{ propertyId, tenancyId: tenancy.id }}
            variant="outlined"
            sx={{ minHeight: 44, px: 2, flexShrink: 0 }}
          >
            {m.amounts_change()}
          </ButtonLink>
        )}
        onUndoRent={setUndoingRent}
        onChangeOccupants={setChangingOccupants}
        onUndoOccupants={setUndoingOccupants}
        currentActions={(tenancy) => {
          const status = tenancyStatus(tenancy, view.today)
          return (
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
              {/* A tenancy that hasn't started has no notice date that is
                  both on or after its start and not in the future. */}
              {tenancy.noticeGivenBy === null &&
              status.kind !== 'ended' &&
              status.kind !== 'starts' ? (
                <ButtonLink
                  to="/properties/$propertyId/tenancy/$tenancyId/end"
                  params={{ propertyId, tenancyId: tenancy.id }}
                  variant="outlined"
                  sx={{ minHeight: 48 }}
                >
                  {m.tenancy_end_title()}
                </ButtonLink>
              ) : null}
              {/* A tenancy with a last day (a fixed term, or an ending
                  recorded) can be followed by the next one. */}
              {tenancy.validTo !== null ? (
                <ButtonLink
                  to="/properties/$propertyId/tenancy/new"
                  params={{ propertyId }}
                  sx={{ minHeight: 48 }}
                >
                  {m.tenancy_add_next()}
                </ButtonLink>
              ) : null}
              {status.kind === 'notice_given' ? (
                <>
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={() => {
                      setCancelling(tenancy)
                    }}
                    sx={{ textDecoration: 'underline' }}
                  >
                    {m.tenancy_cancel()}
                  </Button>
                </>
              ) : null}
            </Stack>
          )
        }}
      />
      {changingOccupants ? (
        <OccupantsDialog
          open
          propertyId={propertyId}
          tenancyId={changingOccupants.id}
          onClose={() => {
            setChangingOccupants(undefined)
          }}
          onDone={async () => {
            setChangingOccupants(undefined)
            await router.invalidate()
          }}
        />
      ) : null}
      {undoingOccupants && latestOccupants && previousOccupants ? (
        <UndoDialog
          open
          onClose={() => {
            setUndoingOccupants(undefined)
          }}
          title={m.tenancy_occupants_undo_title({
            date: formatDate(latestOccupants.validFrom),
          })}
          text={m.tenancy_occupants_undo_text({
            persons: String(previousOccupants.value),
            date: formatDate(previousOccupants.validFrom),
          })}
          undo={() =>
            undoTenancyOccupants({
              data: { propertyId, tenancyId: undoingOccupants.id },
            })
          }
          failureEvent="tenancy.occupants_undo_failed"
          onDone={async () => {
            setUndoingOccupants(undefined)
            await router.invalidate()
          }}
        />
      ) : null}
      {undoingRent && latestRent && previousRent ? (
        <UndoDialog
          open
          onClose={() => {
            setUndoingRent(undefined)
          }}
          title={m.amounts_undo_title({
            date: formatDate(latestRent.validFrom),
          })}
          text={m.amounts_undo_text({
            amount: formatMoney(previousRent.value),
            date: formatDate(previousRent.validFrom),
          })}
          undo={() =>
            undoTenancyRent({
              data: { propertyId, tenancyId: undoingRent.id },
            })
          }
          failureEvent="tenancy.rent_undo_failed"
          onDone={async () => {
            setUndoingRent(undefined)
            await router.invalidate()
          }}
        />
      ) : null}
      {cancelling ? (
        <CancelEndingDialog
          propertyId={propertyId}
          tenancy={cancelling}
          open
          onClose={() => {
            setCancelling(undefined)
          }}
          onDone={async () => {
            setCancelling(undefined)
            await router.invalidate()
          }}
        />
      ) : null}
    </>
  )
}
