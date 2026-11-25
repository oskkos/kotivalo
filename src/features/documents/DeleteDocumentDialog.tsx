// Confirming the deletion of a document (Design canvas: "Poista dokumentti"):
// it names the document and says it is deleted for everyone with access and
// can't be undone (openspec: documents, "Deleting a document").
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
import { failureReason } from '#/lib/network-error'
import type { AlertReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import type { DocumentDetails } from './document.repository.server'
import { deleteDocument } from './functions'

interface Props {
  open: boolean
  document: DocumentDetails
  onClose: () => void
  onDeleted: () => Promise<void>
}

export function DeleteDocumentDialog(props: Props) {
  const { document } = props
  const titleId = useId()
  const [busy, setBusy] = useState(false)
  const [alert, setAlert] = useState<AlertReason>()

  async function remove() {
    setAlert(undefined)
    setBusy(true)
    try {
      const result = await deleteDocument({
        data: { propertyId: document.propertyId, documentId: document.id },
      })
      if (result.ok) {
        await props.onDeleted()
      } else {
        setAlert(result.reason)
      }
    } catch (error) {
      clientLog.error('document.delete_failed', {}, error)
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
        {m.documents_delete_title()}
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 1.5 }}>
          <DialogContentText>
            {m.documents_delete_text({ name: document.name })}
          </DialogContentText>
          {alert === undefined ? null : <ReasonAlert reason={alert} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" disabled={busy} onClick={props.onClose}>
          {m.documents_cancel()}
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={busy}
          onClick={() => void remove()}
        >
          {m.documents_delete_confirm()}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
