// A page failed to render or load (the root route's errorComponent): log it
// and tell the user: no connection, or something went wrong with the error
// reference.
import Box from '@mui/material/Box'
import { useEffect } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { clientLog } from '#/lib/client-log'
import { failureReason } from '#/lib/network-error'

export function ErrorView({ error }: { error: unknown }) {
  useEffect(() => {
    clientLog.error('app.render_error', {}, error)
  }, [error])
  return (
    <Box component="main" sx={{ px: 2.5, py: 7 }}>
      <ReasonAlert reason={failureReason(error)} />
    </Box>
  )
}
