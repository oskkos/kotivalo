// Deleting a rent payment, with a confirmation (openspec: rent-payments,
// "Deleting a rent payment"). Payments are not edited: a wrong one is
// deleted and recorded again.
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
import { formatDate, formatMoney } from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { deleteRentPayment } from './functions'
import type { RentPayment } from './rent-payment.repository.server'

export function DeletePaymentDialog(props: {
  propertyId: string
  payment: RentPayment
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const { payment } = props
  const [alert, setAlert] = useState<AlertReason>()
  const [busy, setBusy] = useState(false)

  async function remove() {
    setAlert(undefined)
    setBusy(true)
    try {
      const result = await deleteRentPayment({
        data: { propertyId: props.propertyId, paymentId: payment.id },
      })
      if (result.ok) {
        await props.onDone()
      } else {
        setAlert(result.reason)
      }
    } catch (error) {
      clientLog.error('rent_payment.delete_failed', {}, error)
      setAlert(failureReason(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={props.onClose} aria-labelledby="delete-payment-title">
      <DialogTitle
        id="delete-payment-title"
        sx={{ fontSize: 20, fontWeight: 900, lineHeight: 1.3 }}
      >
        {m.rent_payment_delete_title()}
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 1.5 }}>
          <DialogContentText>
            {m.rent_payment_delete_text({
              amount: formatMoney(payment.amount),
              date: formatDate(payment.paidOn),
            })}
          </DialogContentText>
          {alert === undefined ? null : <ReasonAlert reason={alert} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" color="inherit" onClick={props.onClose}>
          {m.rent_payment_cancel()}
        </Button>
        <Button
          color="error"
          disabled={busy}
          onClick={() => {
            void remove()
          }}
        >
          {m.rent_payment_delete()}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
