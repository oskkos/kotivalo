// Setting the financing charge treatment (Design canvas: Kasittely):
// income-recognised or capitalised, from a date, with the history and
// undoing the latest change (spec: "The financing charge treatment",
// "Undoing the latest treatment change").
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm, useSelector } from '@tanstack/react-form'
import { useState } from 'react'
import { z } from 'zod'
import { ChoiceField } from '#/components/form/ChoiceField'
import { ReasonAlert } from '#/components/ReasonAlert'
import { TextField } from '#/components/form/TextField'
import { clientLog } from '#/lib/client-log'
import { formatDate } from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import {
  FINANCING_TREATMENTS,
  type FinancingTreatment,
} from '#/server/db/schema'
import { colors, radii } from '#/theme/tokens'
import { setFinancingTreatment, undoFinancingTreatment } from './functions'
import { treatmentLabel } from './labels'
import type { RecurringAmountsView } from './recurring-amounts.server'
import { monthStartDate } from './schemas'
import { UndoButton, UndoDialog } from './UndoDialog'

interface Props {
  propertyId: string
  view: RecurringAmountsView
  address: string
  /** After saving: reload and go back to the page. */
  onDone: () => Promise<void>
  onClose: () => void
}

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

const treatmentChoice = z.enum(FINANCING_TREATMENTS, {
  error: 'treatment_required' satisfies FieldReason,
})

const explanation: Record<FinancingTreatment, () => string> = {
  income_recognised: () => m.amounts_treatment_income_recognised_text(),
  capitalised: () => m.amounts_treatment_capitalised_text(),
}

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

export function TreatmentForm(props: Props) {
  const { view, propertyId } = props
  const [alert, setAlert] = useState<AlertReason>()
  const [dateReason, setDateReason] = useState<FieldReason>()
  const treatments = view.treatments
  const latest = treatments.at(-1)
  const previous = treatments.at(-2)
  const [undoing, setUndoing] = useState(false)

  const form = useForm({
    defaultValues: { treatment: '' as FinancingTreatment | '', from: '' },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      setDateReason(undefined)
      if (value.treatment === '') {
        return
      }
      try {
        const result = await setFinancingTreatment({
          data: { propertyId, treatment: value.treatment, from: value.from },
        })
        if (result.ok) {
          await props.onDone()
        } else if (isIn(DATE_REASONS, result.reason)) {
          setDateReason(result.reason)
        } else {
          setAlert(result.reason as AlertReason)
        }
      } catch (error) {
        clientLog.error('financing_treatment.save_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })
  const chosen = useSelector(form.store, (s) => s.values.treatment)

  return (
    <Stack
      component="form"
      noValidate
      aria-labelledby="treatment-form-title"
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
            id="treatment-form-title"
            variant="h3"
            component="h1"
            sx={{ fontSize: 18, textAlign: 'center' }}
          >
            {m.amounts_treatment_form_title()}
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
        <Typography>{m.amounts_treatment_form_intro()}</Typography>
        <form.Field name="treatment" validators={{ onSubmit: treatmentChoice }}>
          {(field) => (
            <ChoiceField
              field={field}
              label={m.amounts_treatment_label()}
              choices={FINANCING_TREATMENTS.map((value) => ({
                value,
                label: treatmentLabel[value](),
              }))}
            />
          )}
        </form.Field>
        {chosen === '' ? null : (
          <Box
            sx={{
              bgcolor: colors.yellowTint,
              borderRadius: `${String(radii.input)}px`,
              px: 1.75,
              py: 1.5,
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.45,
            }}
          >
            {explanation[chosen]()}
          </Box>
        )}
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
          {m.amounts_treatment_form_hint()}
        </Typography>
        {alert === undefined ? null : <ReasonAlert reason={alert} />}
        {treatments.length > 0 ? (
          <Stack component="section" sx={{ gap: 0.75 }}>
            <Typography variant="h4" component="h2" sx={{ fontWeight: 900 }}>
              {m.amounts_treatment_form_history()}
            </Typography>
            <Box
              component="ul"
              aria-label={m.amounts_treatment_form_history()}
              sx={{
                listStyle: 'none',
                m: 0,
                px: 2,
                bgcolor: 'background.paper',
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: `${String(radii.card)}px`,
              }}
            >
              {[...treatments].reverse().map((p) => (
                <Box
                  component="li"
                  key={p.validFrom}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    minHeight: 52,
                    '& + &': { borderTop: `1px solid ${colors.divider}` },
                  }}
                >
                  <Typography component="span" sx={{ fontWeight: 800 }}>
                    {m.amounts_from({ date: formatDate(p.validFrom) })}
                  </Typography>
                  <Typography component="span" sx={{ fontWeight: 900 }}>
                    {treatmentLabel[p.value]()}
                  </Typography>
                </Box>
              ))}
            </Box>
            <UndoButton
              onClick={() => {
                setUndoing(true)
              }}
            />
          </Stack>
        ) : null}
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
                : m.amounts_form_save_first()}
            </Button>
          )}
        </form.Subscribe>
      </Box>
      {latest ? (
        <UndoDialog
          open={undoing}
          onClose={() => {
            setUndoing(false)
          }}
          title={m.amounts_treatment_undo_title({
            date: formatDate(latest.validFrom),
          })}
          text={
            previous
              ? m.amounts_treatment_undo_text({
                  treatment: treatmentLabel[previous.value](),
                  date: formatDate(previous.validFrom),
                })
              : m.amounts_treatment_undo_only_text()
          }
          undo={() => undoFinancingTreatment({ data: { propertyId } })}
          failureEvent="financing_treatment.undo_failed"
          onDone={props.onDone}
        />
      ) : null}
    </Stack>
  )
}
