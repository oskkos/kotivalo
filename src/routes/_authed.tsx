// Every page under this pathless layout needs a signed-in user (spec: "Pages
// for signed-in users only"); others are sent to /sign-in.
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getSignedInUser } from '#/features/authentication/functions'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    const user = await getSignedInUser()
    if (!user) {
      throw redirect({ to: '/sign-in' })
    }
    // The language cookie was put back to the account's language: load the
    // page again so it renders in that language from the start (on the
    // server a redirect carrying the cookie, in the browser a full reload).
    if (user.localeReset) {
      throw redirect({ href: location.href, reloadDocument: true })
    }
    return { user }
  },
  component: Outlet,
})
