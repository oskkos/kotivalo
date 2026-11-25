// Deleting a flat for good (openspec: properties, "Deleting a flat" and
// "Confirming the deletion of a flat"). The dialog loads what deleting would
// remove, then shows one of three states: a plain confirmation for a flat
// without data, the losses and the street address to type for a flat with
// data, or why it can't be deleted with archiving offered instead.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { noticeState } from '#/components/NavigationNotice'
import { ReasonAlert } from '#/components/ReasonAlert'
import { clientLog } from '#/lib/client-log'
import { failureReason } from '#/lib/network-error'
import type { AlertReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { addressMatches } from './address-match'
import { deleteProperty, getPropertyDeletion } from './functions'
import type { Property } from './property'

type Deletion = Awaited<ReturnType<typeof getPropertyDeletion>>

export function DeleteFlatDialog(props: {
  property: Property
  open: boolean
  onClose: () => void
  /** The flat can't be deleted and the user chose to archive it instead. */
  onArchive: () => void
}) {
  const router = useRouter()
  const { property } = props
  const address = property.streetAddress
  const [deletion, setDeletion] = useState<Deletion>()
  const [alert, setAlert] = useState<AlertReason>()
  const [busy, setBusy] = useState(false)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    let current = true
    getPropertyDeletion({ data: { id: property.id } }).then(
      (result) => {
        if (current) {
          setDeletion(result)
        }
      },
      (error: unknown) => {
        clientLog.error('property.deletion_load_failed', {}, error)
        if (current) {
          setAlert(failureReason(error))
        }
      },
    )
    return () => {
      current = false
    }
  }, [property.id])

  async function remove() {
    setAlert(undefined)
    setBusy(true)
    try {
      const result = await deleteProperty({ data: { id: property.id } })
      if (result.ok) {
        await router.navigate({
          to: '/',
          state: noticeState(m.property_deleted_notice({ address })),
        })
        // The router shows the list it kept from before while it loads the
        // new one; without this the flat is still on it.
        await router.invalidate()
        return
      }
      setAlert(result.reason)
    } catch (error) {
      clientLog.error('property.delete_failed', {}, error)
      setAlert(failureReason(error))
    } finally {
      setBusy(false)
    }
  }

  const refused =
    deletion?.ok === false
      ? deletion.reason
      : deletion?.ok && !deletion.allowed
        ? deletion.reason
        : undefined
  const allowed = deletion?.ok && deletion.allowed ? deletion : undefined
  const needsAddress = allowed?.hasData === true
  const canDelete =
    allowed !== undefined && (!needsAddress || addressMatches(typed, address))

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      aria-labelledby="delete-flat-title"
      fullWidth
    >
      <DialogTitle
        id="delete-flat-title"
        sx={{ fontSize: 20, fontWeight: 900, lineHeight: 1.3 }}
      >
        {m.property_delete_title()}
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 1.5 }}>
          {deletion === undefined && alert === undefined ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress aria-label={m.property_delete_loading()} />
            </Box>
          ) : null}
          {refused === undefined ? null : (
            <>
              <ReasonAlert reason={refused} />
              {deletion?.ok &&
              !deletion.allowed &&
              deletion.otherOwners.length > 0 ? (
                <DialogContentText>
                  {m.property_delete_other_owners_names({
                    names: deletion.otherOwners.join(', '),
                  })}
                </DialogContentText>
              ) : null}
            </>
          )}
          {allowed === undefined ? null : needsAddress ? (
            <>
              <DialogContentText>
                {m.property_delete_data_text({ address })}
              </DialogContentText>
              <Box>
                <Typography variant="subtitle2" component="p">
                  {m.property_delete_losses()}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {[
                    m.property_delete_tenancies({
                      count: allowed.counts.tenancies,
                    }),
                    m.property_delete_rent_payments({
                      count: allowed.counts.rentPayments,
                    }),
                    m.property_delete_transactions({
                      count: allowed.counts.transactions,
                    }),
                    m.property_delete_receipts({
                      count: allowed.counts.receipts,
                    }),
                  ].map((line) => (
                    <Typography key={line} component="li" variant="body2">
                      {line}
                    </Typography>
                  ))}
                </Box>
              </Box>
              {allowed.members.length > 0 ? (
                <DialogContentText>
                  {m.property_delete_members({
                    count: allowed.members.length,
                    names: allowed.members.join(', '),
                  })}
                </DialogContentText>
              ) : null}
              <TextField
                label={m.property_delete_address()}
                placeholder={address}
                value={typed}
                autoComplete="off"
                onChange={(event) => {
                  setTyped(event.target.value)
                }}
              />
            </>
          ) : (
            <DialogContentText>
              {m.property_delete_empty_text({ address })}
            </DialogContentText>
          )}
          {alert === undefined ? null : <ReasonAlert reason={alert} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" color="inherit" onClick={props.onClose}>
          {m.property_delete_cancel()}
        </Button>
        {refused === 'property_delete_other_owners' ? (
          <Button onClick={props.onArchive}>{m.property_archive()}</Button>
        ) : null}
        {allowed === undefined ? null : (
          <Button
            color="error"
            loading={busy}
            disabled={!canDelete}
            onClick={() => {
              void remove()
            }}
          >
            {needsAddress
              ? m.property_delete_permanently()
              : m.property_delete_confirm()}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
