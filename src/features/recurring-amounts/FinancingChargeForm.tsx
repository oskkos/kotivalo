// Adding a financing charge (Design canvas: RahoitusUusi): its name, monthly
// amount and start date, and a note that the flat's treatment applies to it
// too (spec: "Adding a financing charge").
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { TextField } from '#/components/form/TextField'
import { clientLog } from '#/lib/client-log'
import { formatDate } from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { addFinancingCharge } from './functions'
import { treatmentLabel } from './labels'
import { periodOn } from './periods'
import type { RecurringAmountsView } from './recurring-amounts.server'
import { financingChargeName, monthStartDate, typedAmount } from './schemas'

interface Props {
  propertyId: string
  view: RecurringAmountsView
  address: string
  /** After adding: reload and go back to the page. */
  onDone: () => Promise<void>
  onClose: () => void
}

const NAME_REASONS = [
  'financing_charge_name_required',
  'financing_charge_name_too_long',
  'financing_charge_name_taken',
] as const
const AMOUNT_REASONS = ['amount_invalid'] as const
const DATE_REASONS = [
  'date_invalid',
  'amount_date_not_month_start',
  'amount_date_before_ownership',
  'amount_date_too_early',
] as const

const isIn = <T extends string>(
  list: readonly T[],
  value: string,
): value is T => (list as readonly string[]).includes(value)

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  )
}

export function FinancingChargeForm(props: Props) {
  const { view, propertyId } = props
  const [alert, setAlert] = useState<AlertReason>()
  const [nameReason, setNameReason] = useState<FieldReason>()
  const [amountReason, setAmountReason] = useState<FieldReason>()
  const [dateReason, setDateReason] = useState<FieldReason>()
  const treatment = periodOn(view.treatments, view.today)

  const form = useForm({
    defaultValues: { name: '', amount: '', from: '' },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      setNameReason(undefined)
      setAmountReason(undefined)
      setDateReason(undefined)
      try {
        const result = await addFinancingCharge({
          data: {
            propertyId,
            name: value.name,
            amount: value.amount,
            from: value.from,
          },
        })
        if (result.ok) {
          await props.onDone()
        } else if (isIn(NAME_REASONS, result.reason)) {
          setNameReason(result.reason)
        } else if (isIn(AMOUNT_REASONS, result.reason)) {
          setAmountReason(result.reason)
        } else if (isIn(DATE_REASONS, result.reason)) {
          setDateReason(result.reason)
        } else {
          setAlert(result.reason as AlertReason)
        }
      } catch (error) {
        clientLog.error('financing_charge.add_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  return (
    <Stack
      component="form"
      noValidate
      aria-labelledby="charge-form-title"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      sx={{ minHeight: '100dvh' }}
    >
      <Box
        component="header"
        sx={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr 44px',
          alignItems: 'center',
          px: 1.5,
          pt: 2,
          pb: 0.5,
        }}
      >
        <IconButton aria-label={m.amounts_form_close()} onClick={props.onClose}>
          <CloseIcon />
        </IconButton>
        <Stack sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography
            id="charge-form-title"
            variant="h3"
            component="h1"
            sx={{ fontSize: 18, textAlign: 'center' }}
          >
            {m.amounts_financing_add()}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {props.address}
          </Typography>
        </Stack>
      </Box>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 2, px: 2.5, pt: 1.25, pb: 2.5 }}
      >
        <Typography sx={{ fontWeight: 700, lineHeight: 1.45 }}>
          {m.amounts_charge_form_intro()}
        </Typography>
        <form.Field
          name="name"
          validators={{ onChange: financingChargeName }}
          listeners={{
            onChange: () => {
              setNameReason(undefined)
            },
          }}
        >
          {(field) => (
            <TextField
              field={field}
              reason={nameReason}
              label={m.amounts_charge_form_name()}
              slotProps={{ htmlInput: { maxLength: 60 } }}
            />
          )}
        </form.Field>
        <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
          {m.amounts_charge_form_name_hint()}
        </Typography>
        <form.Field
          name="amount"
          validators={{ onChange: typedAmount }}
          listeners={{
            onChange: () => {
              setAmountReason(undefined)
            },
          }}
        >
          {(field) => (
            <TextField
              field={field}
              reason={amountReason}
              label={m.amounts_form_amount()}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            />
          )}
        </form.Field>
        <form.Field
          name="from"
          validators={{ onChange: monthStartDate }}
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
        <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
          {m.amounts_charge_form_from_hint()}
        </Typography>
        <Box
          sx={{
            bgcolor: colors.lavenderTint,
            borderRadius: `${String(radii.input)}px`,
            px: 1.75,
            py: 1.5,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.4,
          }}
        >
          {treatment
            ? m.amounts_charge_form_treatment({
                treatment: treatmentLabel[treatment.value](),
                date: formatDate(treatment.validFrom),
              })
            : m.amounts_charge_form_treatment_not_set()}
        </Box>
        {alert === undefined ? null : <ReasonAlert reason={alert} />}
      </Stack>
      <Box
        component="footer"
        sx={{
          px: 2.5,
          pt: 1.5,
          pb: 3.5,
          borderTop: `1px solid ${colors.cardBorder}`,
        }}
      >
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(submitting) => (
            <Button
              type="submit"
              fullWidth
              loading={submitting}
              loadingPosition="start"
              sx={{ minHeight: 56 }}
            >
              {submitting
                ? m.amounts_form_saving()
                : m.amounts_charge_form_save()}
            </Button>
          )}
        </form.Subscribe>
      </Box>
    </Stack>
  )
}
