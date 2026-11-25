import {
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { NotFoundView } from '#/components/NotFoundView'
import { UndoDialog } from '#/features/recurring-amounts/UndoDialog'
import {
  getUsageCharges,
  undoUsageCharge,
} from '#/features/usage-charges/functions'
import { occupantsOn } from '#/features/usage-charges/months'
import { UsageChargeForm } from '#/features/usage-charges/UsageChargeForm'
import { chargeName } from '#/lib/charge-labels'
import { formatDate, formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/usage-charges/$usageChargeId',
)({
  loader: async ({ params }) => {
    const view = await getUsageCharges({
      data: { propertyId: params.propertyId },
    })
    if (!view.ok || !view.charges.some((c) => c.id === params.usageChargeId)) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    if (view.role !== 'owner') {
      throw redirect({
        to: '/properties/$propertyId/usage-charges',
        params: { propertyId: params.propertyId },
      })
    }
    return view
  },
  head: () => ({
    meta: [
      {
        title: m.amounts_form_page_title({
          title: m.usage_charge_form_title(),
        }),
      },
    ],
  }),
  component: UsageChargeRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_usage_charge_not_found_title()}
      text={m.reason_usage_charge_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function UsageChargeRoute() {
  const view = Route.useLoaderData()
  const { propertyId, usageChargeId } = Route.useParams()
  const router = useRouter()
  const [undoing, setUndoing] = useState(false)
  const charge = view.charges.find((c) => c.id === usageChargeId)
  const toPage = () =>
    router.navigate({
      to: '/properties/$propertyId/usage-charges',
      params: { propertyId },
    })
  if (!charge) {
    return null
  }
  const latest = charge.periods.at(-1)
  const previous = charge.periods.at(-2)
  return (
    <>
      <UsageChargeForm
        propertyId={propertyId}
        address={view.property.streetAddress}
        persons={occupantsOn(view.tenancies, `${view.today.slice(0, 7)}-01`)}
        charge={charge}
        onUndo={() => {
          setUndoing(true)
        }}
        onDone={async () => {
          await router.invalidate()
          await toPage()
        }}
        onClose={() => {
          void toPage()
        }}
      />
      {undoing && latest ? (
        <UndoDialog
          open
          onClose={() => {
            setUndoing(false)
          }}
          title={m.amounts_undo_title({ date: formatDate(latest.validFrom) })}
          text={
            previous
              ? m.amounts_undo_text({
                  amount: formatMoney(previous.value),
                  date: formatDate(previous.validFrom),
                })
              : m.usage_charge_undo_remove({ name: chargeName(charge) })
          }
          undo={() =>
            undoUsageCharge({ data: { propertyId, chargeId: usageChargeId } })
          }
          failureEvent="usage_charge.undo_failed"
          onDone={async () => {
            setUndoing(false)
            await router.invalidate()
            await toPage()
          }}
        />
      ) : null}
    </>
  )
}
