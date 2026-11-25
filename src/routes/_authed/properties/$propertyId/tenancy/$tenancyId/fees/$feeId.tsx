import {
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { NotFoundView } from '#/components/NotFoundView'
import { UndoDialog } from '#/features/recurring-amounts/UndoDialog'
import { getTenancy, undoTenantFee } from '#/features/tenancies/functions'
import { TenantFeeForm } from '#/features/tenancies/TenantFeeForm'
import { chargeName } from '#/lib/charge-labels'
import { formatDate, formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/tenancy/$tenancyId/fees/$feeId',
)({
  loader: async ({ params }) => {
    const result = await getTenancy({
      data: { propertyId: params.propertyId, tenancyId: params.tenancyId },
    })
    if (!result.ok || !result.fees.some((fee) => fee.id === params.feeId)) {
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
  head: () => ({
    meta: [
      {
        title: m.amounts_form_page_title({ title: m.tenant_fee_form_title() }),
      },
    ],
  }),
  component: TenantFeeRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_tenant_fee_not_found_title()}
      text={m.reason_tenant_fee_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function TenantFeeRoute() {
  const { tenancy, rents, occupants, fees, property } = Route.useLoaderData()
  const { propertyId, feeId } = Route.useParams()
  const router = useRouter()
  const [undoing, setUndoing] = useState(false)
  const fee = fees.find((f) => f.id === feeId)
  const toPage = () =>
    router.navigate({
      to: '/properties/$propertyId/tenancy',
      params: { propertyId },
    })
  if (!fee) {
    return null
  }
  const latest = fee.amounts.at(-1)
  const previous = fee.amounts.at(-2)
  return (
    <>
      <TenantFeeForm
        propertyId={propertyId}
        address={property.streetAddress}
        tenancy={tenancy}
        rents={rents}
        occupants={occupants}
        fees={fees}
        fee={fee}
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
              : m.tenant_fee_undo_remove({ name: chargeName(fee) })
          }
          undo={() =>
            undoTenantFee({
              data: { propertyId, tenancyId: tenancy.id, feeId },
            })
          }
          failureEvent="tenancy.fee_undo_failed"
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
