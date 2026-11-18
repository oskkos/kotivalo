import { createFileRoute } from '@tanstack/react-router'
import { SignInPage } from '#/features/authentication/SignInPage'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/sign-in')({
  head: () => ({ meta: [{ title: m.sign_in_page_title() }] }),
  component: () => <SignInPage />,
})
