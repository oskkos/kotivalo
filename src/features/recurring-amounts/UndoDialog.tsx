// "Undo the latest change" and its confirmation, for an amount or the
// treatment (Design canvas: VastikePeru). The form gives the texts and the
// server call; the dialog shows a refusal or failure and reloads once done.
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import { useState } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { clientLog } from '#/lib/client-log'
import { failureReason } from '#/lib/network-error'
import type { AlertReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  text: string
  /** The server call. */
  undo: () => Promise<{ ok: true } | { ok: false; reason: AlertReason }>
  /** The client log event when the call fails. */
  failureEvent: string
  /** After undoing: reload and go back to the page. */
  onDone: () => Promise<void>
}

export function UndoDialog(props: Props) {
  const [alert, setAlert] = useState<AlertReason>()
  const [busy, setBusy] = useState(false)

  async function undo() {
    setAlert(undefined)
    setBusy(true)
    try {
      const result = await props.undo()
      if (result.ok) {
        await props.onDone()
      } else {
        setAlert(result.reason)
      }
    } catch (error) {
      clientLog.error(props.failureEvent, {}, error)
      setAlert(failureReason(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      aria-labelledby="undo-title"
    >
      <DialogTitle
        id="undo-title"
        sx={{ fontSize: 20, fontWeight: 900, lineHeight: 1.3 }}
      >
        {props.title}
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 1.5 }}>
          <DialogContentText>{props.text}</DialogContentText>
          {alert === undefined ? null : <ReasonAlert reason={alert} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" color="inherit" onClick={props.onClose}>
          {m.amounts_dialog_cancel()}
        </Button>
        <Button
          color="error"
          loading={busy}
          onClick={() => {
            void undo()
          }}
        >
          {m.amounts_undo_confirm()}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** "Undo the latest change", under a history. */
export function UndoButton(props: { onClick: () => void }) {
  return (
    <Button
      variant="text"
      color="inherit"
      onClick={props.onClick}
      sx={{ alignSelf: 'flex-start', textDecoration: 'underline' }}
    >
      {m.amounts_undo()}
    </Button>
  )
}
