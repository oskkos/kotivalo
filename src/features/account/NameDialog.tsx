// "Change name" on the account page (Design canvas: TiliNimi, TiliNimiVirhe;
// spec: "Changing the display name"). The rules are those of /welcome.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { TextField } from '#/components/form/TextField'
import { setDisplayName } from '#/features/authentication/functions'
import {
  displayNameInput,
  displayNameSchema,
} from '#/features/authentication/schemas'
import { clientLog } from '#/lib/client-log'
import { failureReason } from '#/lib/network-error'
import type { AlertReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'

interface Props {
  name: string
  onClose: () => void
  /** Reloads the user, so the page shows the new name. */
  onSaved: () => Promise<void>
}

export function NameDialog({ name, onClose, onSaved }: Props) {
  const [alert, setAlert] = useState<AlertReason>()
  const form = useForm({
    defaultValues: { name },
    validators: { onChange: displayNameInput },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      try {
        await setDisplayName({
          data: { name: displayNameSchema.parse(value.name) },
        })
        await onSaved()
        onClose()
      } catch (error) {
        clientLog.error('account.name_save_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  return (
    <Dialog open onClose={onClose} aria-labelledby="account-name-title">
      <Box
        component="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <DialogTitle
          id="account-name-title"
          sx={{ fontSize: 20, fontWeight: 900, lineHeight: 1.3 }}
        >
          {m.account_change_name()}
        </DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 1.5, pt: 1 }}>
            <form.Field name="name">
              {(field) => (
                <TextField
                  field={field}
                  label={m.account_name_label()}
                  autoComplete="given-name"
                  fullWidth
                />
              )}
            </form.Field>
            <Typography variant="body2" color="text.secondary">
              {m.account_name_help()}
            </Typography>
            {alert === undefined ? null : <ReasonAlert reason={alert} />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" color="inherit" onClick={onClose}>
            {m.account_cancel()}
          </Button>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(submitting) => (
              <Button type="submit" loading={submitting}>
                {m.account_save()}
              </Button>
            )}
          </form.Subscribe>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
