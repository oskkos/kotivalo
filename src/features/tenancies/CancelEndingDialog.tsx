// Cancelling a tenancy's ending, with a confirmation (openspec: tenancies,
// "Cancelling an ending"). The dialog shows a refusal or failure and
// reloads the page once done.
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
import { formatDate } from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { cancelTenancyEnding } from './functions'
import type { Tenancy } from './tenancy.repository.server'

export function CancelEndingDialog(props: {
  propertyId: string
  tenancy: Tenancy
  open: boolean
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const { tenancy } = props
  const [alert, setAlert] = useState<AlertReason>()
  const [busy, setBusy] = useState(false)

  async function cancel() {
    setAlert(undefined)
    setBusy(true)
    try {
      const result = await cancelTenancyEnding({
        data: { propertyId: props.propertyId, tenancyId: tenancy.id },
      })
      if (result.ok) {
        await props.onDone()
      } else {
        setAlert(result.reason as AlertReason)
      }
    } catch (error) {
      clientLog.error('tenancy.cancel_failed', {}, error)
      setAlert(failureReason(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      aria-labelledby="cancel-ending-title"
    >
      <DialogTitle
        id="cancel-ending-title"
        sx={{ fontSize: 20, fontWeight: 900, lineHeight: 1.3 }}
      >
        {m.tenancy_cancel_title()}
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 1.5 }}>
          <DialogContentText>
            {tenancy.termEnd === null
              ? m.tenancy_cancel_open({ name: tenancy.tenantName })
              : m.tenancy_cancel_fixed({
                  name: tenancy.tenantName,
                  date: formatDate(tenancy.termEnd),
                })}
          </DialogContentText>
          {alert === undefined ? null : <ReasonAlert reason={alert} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" color="inherit" onClick={props.onClose}>
          {m.tenancy_cancel_back()}
        </Button>
        <Button
          loading={busy}
          onClick={() => {
            void cancel()
          }}
        >
          {m.tenancy_cancel_confirm()}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
