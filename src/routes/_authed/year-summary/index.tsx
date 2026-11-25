import { createFileRoute, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { BottomNav } from '#/components/BottomNav'
import { getYearSummary } from '#/features/year-summary/functions'
import { summaryYear } from '#/features/year-summary/schemas'
import { YearSummaryPage } from '#/features/year-summary/YearSummaryPage'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/year-summary/')({
  validateSearch: z.object({ year: summaryYear.optional() }),
  loaderDeps: ({ search }) => ({ year: search.year }),
  loader: ({ deps }) => getYearSummary({ data: { year: deps.year } }),
  head: () => ({ meta: [{ title: m.year_summary_page_title() }] }),
  component: YearSummaryRoute,
})

function YearSummaryRoute() {
  const view = Route.useLoaderData()
  const router = useRouter()
  return (
    <YearSummaryPage
      view={view}
      onYear={(year) => {
        void router.navigate({ to: '/year-summary', search: { year } })
      }}
      // A plain link until the form 7H page's route lands.
      flatHref={(propertyId, year) =>
        `/year-summary/${encodeURIComponent(propertyId)}?year=${String(year)}`
      }
      bottomNav={<BottomNav current="year-summary" />}
    />
  )
}
