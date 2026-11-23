import {
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { NotFoundView } from '#/components/NotFoundView'
import { getProperty } from '#/features/properties/functions'
import {
  AmountForm,
  amountFormTitle,
} from '#/features/recurring-amounts/AmountForm'
import { getRecurringAmounts } from '#/features/recurring-amounts/functions'
import { kindFromSlug } from '#/features/recurring-amounts/labels'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute(
  '/_authed/properties/$propertyId/amounts/$kind',
)({
  loader: async ({ params }) => {
    const kind = kindFromSlug(params.kind)
    if (!kind) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    const [view, property] = await Promise.all([
      getRecurringAmounts({ data: { propertyId: params.propertyId } }),
      getProperty({ data: { id: params.propertyId } }),
    ])
    if (!view.ok || !property.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    if (view.role !== 'owner') {
      // Members see the amounts on the page; only owners change them.
      throw redirect({
        to: '/properties/$propertyId/amounts',
        params: { propertyId: params.propertyId },
      })
    }
    return { kind, view, address: property.property.streetAddress }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? m.amounts_form_page_title({
              title: amountFormTitle(
                loaderData.kind,
                loaderData.view.amounts[loaderData.kind].length > 0,
              ),
            })
          : m.amounts_page_title(),
      },
    ],
  }),
  component: AmountFormRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function AmountFormRoute() {
  const { kind, view, address } = Route.useLoaderData()
  const { propertyId } = Route.useParams()
  const router = useRouter()
  const toPage = () =>
    router.navigate({
      to: '/properties/$propertyId/amounts',
      params: { propertyId },
    })
  return (
    <AmountForm
      // A fresh form for each kind.
      key={kind}
      propertyId={propertyId}
      what={kind}
      view={view}
      address={address}
      onDone={() => router.invalidate().then(toPage)}
      onClose={() => {
        void toPage()
      }}
    />
  )
}
