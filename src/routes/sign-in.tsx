import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSignedInUser } from '#/features/authentication/functions'
import { SignInPage } from '#/features/authentication/SignInPage'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/sign-in')({
  // A signed-in user has nothing to do here.
  beforeLoad: async () => {
    if (await getSignedInUser()) {
      throw redirect({ to: '/' })
    }
  },
  head: () => ({ meta: [{ title: m.sign_in_page_title() }] }),
  component: () => <SignInPage />,
})
