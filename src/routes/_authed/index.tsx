import { BottomNav } from '#/components/BottomNav'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { listProperties } from '#/features/properties/functions'
import { listCurrentOwners } from '#/features/ownership/functions'
import type { CardOwner } from '#/features/properties/ownership-line'
import { PropertyList } from '#/features/properties/PropertyList'
import { CardRentChip } from '#/features/rent-payments/CardRentChip'
import { listRentThisMonth } from '#/features/rent-payments/functions'
import { RentSummary } from '#/features/rent-payments/RentSummary'
import { rentThisMonth } from '#/features/rent-payments/status'
import { listMyInvitations } from '#/features/sharing/functions'
import { InvitationCards } from '#/features/sharing/InvitationCards'
import { FlatStatusChip } from '#/features/tenancies/FlatStatusChip'
import { listTenancyStatuses } from '#/features/tenancies/functions'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/')({
  loader: async () => {
    const [properties, invitations, shares, statuses, rent] = await Promise.all(
      [
        listProperties(),
        listMyInvitations(),
        listCurrentOwners(),
        listTenancyStatuses(),
        listRentThisMonth(),
      ],
    )
    const owners: Record<string, CardOwner[]> = {}
    for (const { propertyId, ...owner } of shares) {
      ;(owners[propertyId] ??= []).push(owner)
    }
    return { properties, invitations, owners, statuses, rent }
  },
  head: () => ({ meta: [{ title: m.properties_page_title() }] }),
  component: HomeRoute,
})

function HomeRoute() {
  const { properties, invitations, owners, statuses, rent } =
    Route.useLoaderData()
  const router = useRouter()
  // Computed in the browser from raw data and the server's today, as on the
  // flat details page.
  const thisMonth = rentThisMonth(rent.flats, rent.today)
  return (
    <PropertyList
      properties={properties}
      owners={owners}
      statuses={Object.fromEntries(
        Object.entries(statuses).map(([id, status]) => [
          id,
          <FlatStatusChip key={id} status={status} />,
        ]),
      )}
      rentStatuses={Object.fromEntries(
        Object.entries(thisMonth.rows).map(([id, row]) => [
          id,
          row ? <CardRentChip key={id} row={row} /> : null,
        ]),
      )}
      summary={
        thisMonth.hasRent ? (
          <RentSummary
            month={rent.today.slice(0, 7)}
            received={thisMonth.received}
            expected={thisMonth.expected}
            late={thisMonth.late}
          />
        ) : null
      }
      bottomNav={<BottomNav current="flats" />}
      notices={
        <InvitationCards
          invitations={invitations}
          onAnswered={() => router.invalidate()}
        />
      }
    />
  )
}
