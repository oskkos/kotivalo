// Confirming the deletion of an entry (Design canvas: "Muokkaa kirjausta ·
// poista"): it names the entry and says that it and its receipt are deleted
// permanently (openspec: transactions, "Deleting an entry").
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import { useId, useState } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { clientLog } from '#/lib/client-log'
import { formatDate, formatMoney } from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { deleteTransaction } from './functions'
import type { TransactionDetails } from './transaction.repository.server'

interface Props {
  open: boolean
  entry: TransactionDetails
  onClose: () => void
  onDeleted: () => Promise<void>
}

export function DeleteDialog(props: Props) {
  const { entry } = props
  const titleId = useId()
  const [busy, setBusy] = useState(false)
  const [alert, setAlert] = useState<AlertReason>()
  const name = m.transactions_delete_entry({
    type:
      entry.type === 'income'
        ? m.transactions_income_title()
        : m.transactions_expense_title(),
    amount: formatMoney(entry.amount),
    date: formatDate(entry.date),
  })

  async function remove() {
    setAlert(undefined)
    setBusy(true)
    try {
      const result = await deleteTransaction({
        data: { propertyId: entry.propertyId, transactionId: entry.id },
      })
      if (result.ok) {
        await props.onDeleted()
      } else {
        setAlert(result.reason)
      }
    } catch (error) {
      clientLog.error('transaction.delete_failed', {}, error)
      setAlert(failureReason(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={props.open} onClose={props.onClose} aria-labelledby={titleId}>
      <DialogTitle
        id={titleId}
        sx={{ fontSize: 20, fontWeight: 900, lineHeight: 1.3 }}
      >
        {m.transactions_delete_title()}
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 1.5 }}>
          <DialogContentText>
            {entry.receipt
              ? m.transactions_delete_text({ entry: name })
              : m.transactions_delete_text_no_receipt({ entry: name })}
          </DialogContentText>
          {alert === undefined ? null : <ReasonAlert reason={alert} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" color="inherit" onClick={props.onClose}>
          {m.transactions_cancel()}
        </Button>
        <Button
          color="error"
          loading={busy}
          onClick={() => {
            void remove()
          }}
        >
          {m.transactions_delete_confirm()}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
