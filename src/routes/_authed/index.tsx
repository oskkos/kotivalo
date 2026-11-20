import { createFileRoute, useRouter } from '@tanstack/react-router'
import { signOut } from '#/features/authentication/functions'
import { listProperties } from '#/features/properties/functions'
import { PropertyList } from '#/features/properties/PropertyList'
import { listMyInvitations } from '#/features/sharing/functions'
import { InvitationCards } from '#/features/sharing/InvitationCards'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/')({
  loader: async () => {
    const [properties, invitations] = await Promise.all([
      listProperties(),
      listMyInvitations(),
    ])
    return { properties, invitations }
  },
  head: () => ({ meta: [{ title: m.properties_page_title() }] }),
  component: HomeRoute,
})

function HomeRoute() {
  const { user } = Route.useRouteContext()
  const { properties, invitations } = Route.useLoaderData()
  const router = useRouter()
  return (
    <PropertyList
      properties={properties}
      email={user.email}
      notices={
        <InvitationCards
          invitations={invitations}
          onAnswered={() => router.invalidate()}
        />
      }
      onSignOut={() => {
        void signOut().then(() => {
          window.location.assign('/sign-in')
        })
      }}
    />
  )
}
