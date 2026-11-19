import { createFileRoute } from '@tanstack/react-router'
import { signOut } from '#/features/authentication/functions'
import { listProperties } from '#/features/properties/functions'
import { PropertyList } from '#/features/properties/PropertyList'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/')({
  loader: () => listProperties(),
  head: () => ({ meta: [{ title: m.properties_page_title() }] }),
  component: HomeRoute,
})

function HomeRoute() {
  const { user } = Route.useRouteContext()
  const properties = Route.useLoaderData()
  return (
    <PropertyList
      properties={properties}
      email={user.email}
      onSignOut={() => {
        void signOut().then(() => {
          window.location.assign('/sign-in')
        })
      }}
    />
  )
}
