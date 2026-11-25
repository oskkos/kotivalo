// Recording a rent payment for a month (Design canvas: Merkitse vuokra
// maksetuksi; openspec: rent-payments, "Recording a rent payment"). The
// amount defaults to what's still missing, the date to today.
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
import { formatAmountInput, formatDate, formatMoney } from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { recordRentPayment } from './functions'
import { rentMonthTitle } from './labels'
import { typedRentPayment } from './schemas'

const AMOUNT_REASONS: readonly string[] = ['rent_payment_amount_invalid']
const DATE_REASONS: readonly string[] = [
  'date_invalid',
  'rent_payment_date_in_future',
]

export interface RecordPaymentDialogProps {
  propertyId: string
  tenancy: { id: string; tenantName: string }
  /** `YYYY-MM`. */
  month: string
  /** Cents still missing; undefined when no rent is set. */
  missing: number | undefined
  /** The month has fees with the rent: they are paid together. */
  withFees?: boolean
  today: string
  open: boolean
  onClose: () => void
  onDone: () => Promise<void>
}

export function RecordPaymentDialog(props: RecordPaymentDialogProps) {
  const [alert, setAlert] = useState<AlertReason>()
  const [amountReason, setAmountReason] = useState<FieldReason>()
  const [dateReason, setDateReason] = useState<FieldReason>()
  const { missing } = props

  const form = useForm({
    defaultValues: {
      amount:
        missing === undefined || missing === 0
          ? ''
          : formatAmountInput(missing),
      paidOn: formatDate(props.today),
    },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      setAmountReason(undefined)
      setDateReason(undefined)
      try {
        const result = await recordRentPayment({
          data: {
            propertyId: props.propertyId,
            tenancyId: props.tenancy.id,
            month: props.month,
            amount: value.amount,
            paidOn: value.paidOn,
          },
        })
        if (result.ok) {
          await props.onDone()
        } else if (AMOUNT_REASONS.includes(result.reason)) {
          setAmountReason(result.reason as FieldReason)
        } else if (DATE_REASONS.includes(result.reason)) {
          setDateReason(result.reason as FieldReason)
        } else {
          setAlert(result.reason as AlertReason)
        }
      } catch (error) {
        clientLog.error('rent_payment.record_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      aria-labelledby="record-payment-title"
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
          id="record-payment-title"
          sx={{ fontSize: 20, fontWeight: 900, lineHeight: 1.3, pb: 0.5 }}
        >
          {m.rent_payment_dialog_title({ rent: rentMonthTitle(props.month) })}
        </DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2, pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              {props.tenancy.tenantName}
            </Typography>
            <form.Field
              name="amount"
              validators={{ onChange: typedRentPayment }}
              listeners={{
                onChange: () => {
                  setAmountReason(undefined)
                },
              }}
            >
              {(field) => (
                <Stack sx={{ gap: 0.5 }}>
                  <TextField
                    field={field}
                    reason={amountReason}
                    label={m.rent_payment_amount()}
                    slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                  />
                  {props.withFees ? (
                    <Typography variant="body2" color="text.secondary">
                      {m.rent_payment_fees_hint()}
                    </Typography>
                  ) : null}
                  {missing !== undefined && missing > 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      {m.rent_payment_amount_hint({
                        amount: formatMoney(missing),
                      })}
                    </Typography>
                  ) : null}
                </Stack>
              )}
            </form.Field>
            <form.Field
              name="paidOn"
              validators={{ onChange: typedDate }}
              listeners={{
                onChange: () => {
                  setDateReason(undefined)
                },
              }}
            >
              {(field) => (
                <Stack sx={{ gap: 0.5 }}>
                  <TextField
                    field={field}
                    reason={dateReason}
                    label={m.rent_payment_date()}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {m.rent_payment_date_hint()}
                  </Typography>
                </Stack>
              )}
            </form.Field>
            {alert === undefined ? null : <ReasonAlert reason={alert} />}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" onClick={props.onClose}>
            {m.rent_payment_cancel()}
          </Button>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(submitting) => (
              <Button type="submit" disabled={submitting}>
                {m.rent_payment_save()}
              </Button>
            )}
          </form.Subscribe>
        </DialogActions>
      </Stack>
    </Dialog>
  )
}
