import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createFileRoute } from '@tanstack/react-router'
import { signOut } from '#/features/authentication/functions'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/')({ component: HomeRoute })

function HomeRoute() {
  const { user } = Route.useRouteContext()
  return (
    <Home
      email={user.email}
      onSignOut={async () => {
        await signOut()
        window.location.assign('/sign-in')
      }}
    />
  )
}

// Placeholder until the real screens land.
export function Home(props: { email: string; onSignOut: () => Promise<void> }) {
  return (
    <Stack component="main" sx={{ gap: 0.5, px: 2.5, py: 4 }}>
      <Typography variant="h1">kotivalo</Typography>
      <Typography color="text.secondary">{m.app_tagline()}</Typography>
      <Typography sx={{ mt: 3 }}>
        {m.home_signed_in_as({ email: props.email })}
      </Typography>
      <Button
        variant="outlined"
        sx={{ alignSelf: 'flex-start', mt: 1 }}
        onClick={() => {
          void props.onSignOut()
        }}
      >
        {m.sign_out()}
      </Button>
    </Stack>
  )
}
