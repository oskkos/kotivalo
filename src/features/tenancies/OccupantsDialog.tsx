// Changing a tenancy's occupants from a date (openspec: tenancies, "Changing
// the occupants"): the new number and the date, the first of a month or the
// tenancy's start day.
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
import { typedDate } from '#/features/ownership/schemas'
import { clientLog } from '#/lib/client-log'
import { failureReason } from '#/lib/network-error'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { setTenancyOccupants } from './functions'
import { typedOccupants } from './schemas'

const DATE_REASONS: readonly string[] = [
  'date_invalid',
  'amount_date_not_month_start',
  'amount_date_too_early',
  'rent_date_before_tenancy',
  'rent_date_after_tenancy',
]

interface Props {
  propertyId: string
  tenancyId: string
  open: boolean
  onClose: () => void
  onDone: () => Promise<void>
}

export function OccupantsDialog(props: Props) {
  const [alert, setAlert] = useState<AlertReason>()
  const [personsReason, setPersonsReason] = useState<FieldReason>()
  const [dateReason, setDateReason] = useState<FieldReason>()

  const form = useForm({
    defaultValues: { persons: '', from: '' },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      setPersonsReason(undefined)
      setDateReason(undefined)
      try {
        const result = await setTenancyOccupants({
          data: {
            propertyId: props.propertyId,
            tenancyId: props.tenancyId,
            persons: value.persons,
            from: value.from,
          },
        })
        if (result.ok) {
          await props.onDone()
        } else if (result.reason === 'occupants_invalid') {
          setPersonsReason(result.reason)
        } else if (DATE_REASONS.includes(result.reason)) {
          setDateReason(result.reason as FieldReason)
        } else {
          setAlert(result.reason as AlertReason)
        }
      } catch (error) {
        clientLog.error('tenancy.occupants_save_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      aria-labelledby="occupants-dialog-title"
      fullWidth
    >
      <Stack
        component="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <DialogTitle
          id="occupants-dialog-title"
          sx={{ fontSize: 20, fontWeight: 900, lineHeight: 1.3, pb: 0.5 }}
        >
          {m.tenancy_occupants_dialog_title()}
        </DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2, pt: 0.5 }}>
            <form.Field
              name="persons"
              validators={{ onChange: typedOccupants }}
              listeners={{
                onChange: () => {
                  setPersonsReason(undefined)
                },
              }}
            >
              {(field) => (
                <TextField
                  field={field}
                  reason={personsReason}
                  label={m.tenancy_occupants_new()}
                  slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                />
              )}
            </form.Field>
            <form.Field
              name="from"
              validators={{ onChange: typedDate }}
              listeners={{
                onChange: () => {
                  setDateReason(undefined)
                },
              }}
            >
              {(field) => (
                <TextField
                  field={field}
                  reason={dateReason}
                  label={m.amounts_form_from()}
                  placeholder={m.date_placeholder()}
                />
              )}
            </form.Field>
            <Typography variant="body2" color="text.secondary">
              {m.tenancy_occupants_hint()}
            </Typography>
            {alert === undefined ? null : <ReasonAlert reason={alert} />}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" onClick={props.onClose}>
            {m.amounts_dialog_cancel()}
          </Button>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(submitting) => (
              <Button type="submit" disabled={submitting}>
                {m.amounts_form_save_change()}
              </Button>
            )}
          </form.Subscribe>
        </DialogActions>
      </Stack>
    </Dialog>
  )
}
