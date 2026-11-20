import { createFileRoute, useRouter } from '@tanstack/react-router'
import { AccountPage } from '#/features/account/AccountPage'
import { signOut } from '#/features/authentication/functions'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/account')({
  head: () => ({ meta: [{ title: m.account_page_title() }] }),
  component: AccountRoute,
})

function AccountRoute() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  return (
    <AccountPage
      name={user.name}
      email={user.email}
      locale={user.locale}
      onBack={() => {
        void router.navigate({ to: '/' })
      }}
      onSignOut={() => {
        void signOut().then(() => {
          window.location.assign('/sign-in')
        })
      }}
      // The server stored the language and set the cookie, so a reload
      // renders the page in it. Not Paraglide's setLocale(): it reads the
      // already-changed cookie as the current language and skips the reload.
      onLanguageChanged={() => {
        window.location.reload()
      }}
    />
  )
}
