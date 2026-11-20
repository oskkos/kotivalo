import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { WelcomePage } from '#/features/authentication/WelcomePage'
import { safeRedirect } from '#/lib/redirect'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/welcome')({
  validateSearch: (search): { redirect?: string } =>
    typeof search.redirect === 'string' ? { redirect: search.redirect } : {},
  // A user who has a name has nothing to do here.
  beforeLoad: ({ context }) => {
    if (context.user.name !== '') {
      throw redirect({ to: '/' })
    }
  },
  head: () => ({ meta: [{ title: m.welcome_page_title() }] }),
  component: WelcomeRoute,
})

function WelcomeRoute() {
  const router = useRouter()
  const { redirect: target } = Route.useSearch()
  return (
    <WelcomePage
      onSaved={() => {
        void router.navigate({ href: safeRedirect(target) })
      }}
    />
  )
}
