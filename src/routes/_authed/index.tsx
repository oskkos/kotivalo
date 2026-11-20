import { createFileRoute, useRouter } from '@tanstack/react-router'
import { listProperties } from '#/features/properties/functions'
import { listCurrentOwners } from '#/features/ownership/functions'
import type { CardOwner } from '#/features/properties/ownership-line'
import { PropertyList } from '#/features/properties/PropertyList'
import { listMyInvitations } from '#/features/sharing/functions'
import { InvitationCards } from '#/features/sharing/InvitationCards'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/')({
  loader: async () => {
    const [properties, invitations, shares] = await Promise.all([
      listProperties(),
      listMyInvitations(),
      listCurrentOwners(),
    ])
    const owners: Record<string, CardOwner[]> = {}
    for (const { propertyId, ...owner } of shares) {
      ;(owners[propertyId] ??= []).push(owner)
    }
    return { properties, invitations, owners }
  },
  head: () => ({ meta: [{ title: m.properties_page_title() }] }),
  component: HomeRoute,
})

function HomeRoute() {
  const { user } = Route.useRouteContext()
  const { properties, invitations, owners } = Route.useLoaderData()
  const router = useRouter()
  return (
    <PropertyList
      properties={properties}
      owners={owners}
      name={user.name}
      notices={
        <InvitationCards
          invitations={invitations}
          onAnswered={() => router.invalidate()}
        />
      }
    />
  )
}
