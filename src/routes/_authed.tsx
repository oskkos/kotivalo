// Every page under this pathless layout needs a signed-in user (spec: "Pages
// for signed-in users only"); others are sent to /sign-in.
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getSignedInUser } from '#/features/authentication/functions'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const user = await getSignedInUser()
    if (!user) {
      throw redirect({ to: '/sign-in' })
    }
    return { user }
  },
  component: Outlet,
})
