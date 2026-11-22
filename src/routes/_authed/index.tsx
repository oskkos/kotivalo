import { BottomNav } from '#/components/BottomNav'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { listProperties } from '#/features/properties/functions'
import { listCurrentOwners } from '#/features/ownership/functions'
import type { CardOwner } from '#/features/properties/ownership-line'
import { PropertyList } from '#/features/properties/PropertyList'
import { listMyInvitations } from '#/features/sharing/functions'
import { InvitationCards } from '#/features/sharing/InvitationCards'
import { FlatStatusChip } from '#/features/tenancies/FlatStatusChip'
import { listTenancyStatuses } from '#/features/tenancies/functions'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/')({
  loader: async () => {
    const [properties, invitations, shares, statuses] = await Promise.all([
      listProperties(),
      listMyInvitations(),
      listCurrentOwners(),
      listTenancyStatuses(),
    ])
    const owners: Record<string, CardOwner[]> = {}
    for (const { propertyId, ...owner } of shares) {
      ;(owners[propertyId] ??= []).push(owner)
    }
    return { properties, invitations, owners, statuses }
  },
  head: () => ({ meta: [{ title: m.properties_page_title() }] }),
  component: HomeRoute,
})

function HomeRoute() {
  const { properties, invitations, owners, statuses } = Route.useLoaderData()
  const router = useRouter()
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
