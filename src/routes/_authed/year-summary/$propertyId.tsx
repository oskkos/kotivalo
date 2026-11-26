import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'
import { NotFoundView } from '#/components/NotFoundView'
import { FlatTaxPage } from '#/features/year-summary/FlatTaxPage'
import { getFlatYear } from '#/features/year-summary/functions'
import { urlYear } from '#/features/year-summary/schemas'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/year-summary/$propertyId')({
  validateSearch: z.object({ year: urlYear }),
  loaderDeps: ({ search }) => ({ year: search.year }),
  loader: async ({ params, deps }) => {
    const view = await getFlatYear({
      data: { propertyId: params.propertyId, year: deps.year },
    })
    if (!view.ok) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's not-found signal
      throw notFound()
    }
    return view
  },
  head: () => ({ meta: [{ title: m.flat_tax_page_title() }] }),
  component: FlatTaxRoute,
  notFoundComponent: () => (
    <NotFoundView
      title={m.reason_property_not_found_title()}
      text={m.reason_property_not_found()}
      backLabel={m.property_back_to_list()}
    />
  ),
})

function FlatTaxRoute() {
  return <FlatTaxPage view={Route.useLoaderData()} />
}
