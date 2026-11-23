import {
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getProperty } from '#/features/properties/functions'
import { getRecurringAmounts } from '#/features/recurring-amounts/functions'
import {
  AmountForm,
  amountFormTitle,
} from '#/features/recurring-amounts/AmountForm'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/amounts/financing/$chargeId',
)({
  loader: async ({ params }) => {
    const [view, property] = await Promise.all([
      getRecurringAmounts({ data: { propertyId: params.propertyId } }),
      getProperty({ data: { id: params.propertyId } }),
    ])
    const charge = view.ok
      ? view.financingCharges.find((each) => each.id === params.chargeId)
      : undefined
    if (!view.ok || !property.ok || !charge) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    if (view.role !== 'owner') {
      // Members see the charges on the page; only owners change them.
      throw redirect({
        to: '/properties/$propertyId/amounts',
        params: { propertyId: params.propertyId },
      })
    }
    return { view, charge, address: property.property.streetAddress }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? m.amounts_form_page_title({
              title: amountFormTitle(loaderData.charge, true),
            })
          : m.amounts_page_title(),
      },
    ],
  }),
  component: FinancingChargeRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function FinancingChargeRoute() {
  const { view, charge, address } = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  const toPage = () =>
    router.navigate({
      to: '/properties/$propertyId/amounts',
      params: { propertyId },
    })
  return (
    <AmountForm
      // A fresh form for each charge.
      key={charge.id}
      propertyId={propertyId}
      what={charge}
      view={view}
      address={address}
      onDone={() => router.invalidate().then(toPage)}
      onClose={() => {
        void toPage()
      }}
    />
  )
}
