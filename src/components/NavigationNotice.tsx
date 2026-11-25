// A notice after navigating (openspec: properties, "Archiving a flat"): the
// page that causes it navigates with `state: { notice }` and the destination
// shows the text once in a snackbar. The text is built by the caller from
// messages, so this component has no copy of its own. The state lives in the
// browser's history entry, not the URL, and is cleared once shown so that a
// reload doesn't repeat the notice.
import Snackbar from '@mui/material/Snackbar'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

/** The history state that carries a notice: pass it as `navigate({ state })`. */
export function noticeState(notice: string): Record<string, string> {
  return { notice }
}

export function NavigationNotice() {
  const navigate = useNavigate()
  const fromHistory = useLocation({
    select: (location) => (location.state as { notice?: unknown }).notice,
  })
  // Taken once, when the page that navigates here mounts the list; the
  // history entry is cleared below, so the state no longer holds it.
  const [notice, setNotice] = useState<string | undefined>(
    typeof fromHistory === 'string' ? fromHistory : undefined,
  )

  useEffect(() => {
    if (typeof fromHistory !== 'string') {
      return
    }
    void navigate({
      to: '.',
      replace: true,
      state: (previous) => ({ ...previous, notice: undefined }),
    })
  }, [fromHistory, navigate])

  return (
    <Snackbar
      open={notice !== undefined}
      autoHideDuration={6000}
      onClose={(_event, reason) => {
        if (reason !== 'clickaway') {
          setNotice(undefined)
        }
      }}
      message={notice}
      slotProps={{
        content: {
          role: 'status',
          sx: { bgcolor: 'primary.main', color: 'primary.contrastText' },
        },
      }}
    />
  )
}
