// Removing a tenancy that hasn't started, with a confirmation (openspec:
// tenancies, "Removing a tenancy that hasn't started"). The dialog shows a
// refusal or failure and hands over once done.
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
import { removeTenancy } from './functions'
import type { Tenancy } from './tenancy.repository.server'

export function RemoveTenancyDialog(props: {
  propertyId: string
  tenancy: Tenancy
  open: boolean
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const { tenancy } = props
  const [alert, setAlert] = useState<AlertReason>()
  const [busy, setBusy] = useState(false)

  async function remove() {
    setAlert(undefined)
    setBusy(true)
    try {
      const result = await removeTenancy({
        data: { propertyId: props.propertyId, tenancyId: tenancy.id },
      })
      if (result.ok) {
        await props.onDone()
      } else {
        setAlert(result.reason)
      }
    } catch (error) {
      clientLog.error('tenancy.remove_failed', {}, error)
      setAlert(failureReason(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      aria-labelledby="remove-tenancy-title"
    >
      <DialogTitle
        id="remove-tenancy-title"
        sx={{ fontSize: 20, fontWeight: 900, lineHeight: 1.3 }}
      >
        {m.tenancy_remove_title()}
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 1.5 }}>
          <DialogContentText>
            {m.tenancy_remove_text({
              name: tenancy.tenantName,
              date: formatDate(tenancy.validFrom),
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
          color="error"
          loading={busy}
          onClick={() => {
            void remove()
          }}
        >
          {m.tenancy_remove_confirm()}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
