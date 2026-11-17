import { createFileRoute } from '@tanstack/react-router'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/')({ component: Home })

// Placeholder until the real screens land.
export function Home() {
  return (
    <Stack component="main" sx={{ gap: 0.5, px: 2.5, py: 4 }}>
      <Typography variant="h1">kotivalo</Typography>
      <Typography color="text.secondary">{m.app_tagline()}</Typography>
    </Stack>
  )
}
