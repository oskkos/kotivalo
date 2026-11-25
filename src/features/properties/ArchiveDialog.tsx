// Archiving a flat for the signed-in user only, with a confirmation
// (openspec: properties, "Archiving a flat"). Confirming lands on the flats
// list with a notice.
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { noticeState } from '#/components/NavigationNotice'
import { ReasonAlert } from '#/components/ReasonAlert'
import { clientLog } from '#/lib/client-log'
import { failureReason } from '#/lib/network-error'
import type { AlertReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { archiveProperty } from './functions'
import type { Property } from './property'

export function ArchiveDialog(props: {
  property: Property
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [alert, setAlert] = useState<AlertReason>()
  const [busy, setBusy] = useState(false)
  const address = props.property.streetAddress

  async function archive() {
    setAlert(undefined)
    setBusy(true)
    try {
      const result = await archiveProperty({ data: { id: props.property.id } })
      if (result.ok) {
        await router.navigate({
          to: '/',
          state: noticeState(m.property_archived_notice({ address })),
        })
        // The router shows the list it kept from before while it loads the
        // new one; without this the flat is still on it.
        await router.invalidate()
        return
      }
      setAlert(result.reason)
    } catch (error) {
      clientLog.error('property.archive_failed', {}, error)
      setAlert(failureReason(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      aria-labelledby="archive-flat-title"
    >
      <DialogTitle
        id="archive-flat-title"
        sx={{ fontSize: 20, fontWeight: 900, lineHeight: 1.3 }}
      >
        {m.property_archive_title()}
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 1.5 }}>
          <DialogContentText>
            {m.property_archive_text({ address })}
          </DialogContentText>
          {alert === undefined ? null : <ReasonAlert reason={alert} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" color="inherit" onClick={props.onClose}>
          {m.property_archive_cancel()}
        </Button>
        <Button
          loading={busy}
          onClick={() => {
            void archive()
          }}
        >
          {m.property_archive_confirm()}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
