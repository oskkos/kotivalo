// Changing a tenancy's rent (Design canvas: Muuta vuokraa · vuokrasuhteelle;
// openspec: tenancies, "Changing a tenancy's rent"): the current rent, the
// new one with the difference per month and its effect on the year, and the
// date, the first of a month or the tenancy's start day.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm, useSelector } from '@tanstack/react-form'
import { useState } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { TextField } from '#/components/form/TextField'
import { typedDate } from '#/features/ownership/schemas'
import { effectText } from '#/features/recurring-amounts/AmountForm'
import {
  periodOn,
  yearEffect,
  type Period,
} from '#/features/recurring-amounts/periods'
import { typedAmount } from '#/features/recurring-amounts/schemas'
import { clientLog } from '#/lib/client-log'
import { parseFiDate } from '#/lib/dates'
import { parseDecimal } from '#/lib/decimal'
import {
  formatMoney,
  formatMoneyChange,
  formatPercentChange,
} from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { setTenancyRent } from './functions'
import type { Tenancy } from './tenancy.repository.server'

interface Props {
  propertyId: string
  address: string
  tenancy: Tenancy
  /** The tenancy's rent periods, oldest first. */
  rents: readonly Period<number>[]
  today: string
  onDone: () => Promise<void>
  onClose: () => void
}

const DATE_REASONS: readonly string[] = [
  'date_invalid',
  'amount_date_not_month_start',
  'amount_date_too_early',
  'rent_date_before_tenancy',
  'rent_date_after_tenancy',
]

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

export function TenancyRentForm(props: Props) {
  const { tenancy, rents } = props
  // The rent the change is compared with: today's, or the first of a
  // tenancy that starts later.
  const day = props.today < tenancy.validFrom ? tenancy.validFrom : props.today
  const current = periodOn(rents, day) ?? rents.at(-1)
  const [alert, setAlert] = useState<AlertReason>()
  const [amountReason, setAmountReason] = useState<FieldReason>()
  const [dateReason, setDateReason] = useState<FieldReason>()

  const form = useForm({
    defaultValues: { amount: '', from: '' },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      setAmountReason(undefined)
      setDateReason(undefined)
      try {
        const result = await setTenancyRent({
          data: {
            propertyId: props.propertyId,
            tenancyId: tenancy.id,
            amount: value.amount,
            from: value.from,
          },
        })
        if (result.ok) {
          await props.onDone()
        } else if (result.reason === 'amount_invalid') {
          setAmountReason(result.reason)
        } else if (DATE_REASONS.includes(result.reason)) {
          setDateReason(result.reason as FieldReason)
        } else {
          setAlert(result.reason as AlertReason)
        }
      } catch (error) {
        clientLog.error('tenancy.rent_save_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  const newCents = parseDecimal(
    useSelector(form.store, (s) => s.values.amount),
    2,
  )
  const from = parseFiDate(useSelector(form.store, (s) => s.values.from))
  const effect =
    current !== undefined && newCents !== undefined && from !== undefined
      ? yearEffect(current.value, newCents, `${from.slice(0, 7)}-01`)
      : undefined

  return (
    <Stack
      component="form"
      noValidate
      aria-labelledby="rent-form-title"
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
            id="rent-form-title"
            variant="h3"
            component="h1"
            sx={{ fontSize: 18, textAlign: 'center' }}
          >
            {current ? m.amounts_form_change_rent() : m.amounts_form_set_rent()}
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
        {current ? (
          <Box
            sx={{
              bgcolor: 'background.paper',
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: `${String(radii.input)}px`,
              px: 1.75,
              py: 1.5,
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontWeight: 800 }}
              color="text.secondary"
            >
              {m.amounts_form_current()}
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 900 }}>
              {m.amounts_per_month({ amount: formatMoney(current.value) })}
            </Typography>
          </Box>
        ) : null}
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
              label={current ? m.amounts_form_new() : m.amounts_form_amount()}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            />
          )}
        </form.Field>
        {effect ? (
          <Box
            role="status"
            sx={{
              bgcolor: colors.yellowTint,
              borderRadius: `${String(radii.input)}px`,
              px: 1.75,
              py: 1.5,
            }}
          >
            <Typography sx={{ fontWeight: 900 }}>
              {m.amounts_per_month({
                amount: formatMoneyChange(effect.difference),
              })}
              {effect.percent === undefined
                ? ''
                : ` (${formatPercentChange(effect.percent)})`}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {effectText('rental_income', effect)}
            </Typography>
          </Box>
        ) : null}
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
        <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
          {m.amounts_form_hint_rent()} {m.tenancy_rent_form_hint()}
        </Typography>
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
                : current
                  ? m.amounts_form_save_change()
                  : m.amounts_form_save_first()}
            </Button>
          )}
        </form.Subscribe>
      </Box>
    </Stack>
  )
}
