// Setting or changing the rent, maintenance charge or financing charge
// (Design canvas: VastikeMuutos, VastikeEnsimmainen, VastikePeru): the new
// amount, its start date, the difference and its effect on that year, the
// history, and undoing the latest change (spec: "Setting a rent or charge",
// "Undoing the latest rent or charge change").
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm, useSelector } from '@tanstack/react-form'
import { useState } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { TextField } from '#/components/form/TextField'
import { clientLog } from '#/lib/client-log'
import { parseFiDate } from '#/lib/dates'
import { parseDecimal } from '#/lib/decimal'
import {
  formatDate,
  formatMoney,
  formatMoneyChange,
  formatPercentChange,
} from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import type { RecurringAmountKind } from '#/server/db/schema'
import { colors, radii } from '#/theme/tokens'
import { setRecurringAmount, undoRecurringAmount } from './functions'
import { periodOn, yearEffect, type Period } from './periods'
import type { RecurringAmountsView } from './recurring-amounts.server'
import { monthStartDate, typedAmount } from './schemas'
import { UndoButton, UndoDialog } from './UndoDialog'

interface Props {
  propertyId: string
  kind: RecurringAmountKind
  view: RecurringAmountsView
  address: string
  /** After saving or undoing: reload and go back to the page. */
  onDone: () => Promise<void>
  onClose: () => void
}

const titles: Record<
  RecurringAmountKind,
  { set: () => string; change: () => string }
> = {
  rent: {
    set: () => m.amounts_form_set_rent(),
    change: () => m.amounts_form_change_rent(),
  },
  maintenance_charge: {
    set: () => m.amounts_form_set_maintenance_charge(),
    change: () => m.amounts_form_change_maintenance_charge(),
  },
  financing_charge: {
    set: () => m.amounts_form_set_financing_charge(),
    change: () => m.amounts_form_change_financing_charge(),
  },
}

/** The form's title: "Set rent" before the first amount, then "Change …". */
export function amountFormTitle(kind: RecurringAmountKind, set: boolean) {
  return set ? titles[kind].change() : titles[kind].set()
}

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

type Target = 'rental_income' | 'expenses' | 'acquisition_cost' | undefined

/** What a change of this kind adds to or takes from, from a date. */
function targetOf(
  kind: RecurringAmountKind,
  view: RecurringAmountsView,
  from: string,
): Target {
  if (kind === 'rent') {
    return 'rental_income'
  }
  if (kind === 'maintenance_charge') {
    return 'expenses'
  }
  const treatment = periodOn(view.treatments, from)?.value
  return treatment === 'capitalised'
    ? 'acquisition_cost'
    : treatment === 'income_recognised'
      ? 'expenses'
      : undefined
}

/** "In 2027, deductible expenses go up by €144.00 over 12 months". */
export function effectText(
  target: Target,
  effect: { year: number; months: number; total: number },
) {
  if (target === undefined || effect.total === 0) {
    return m.amounts_effect_neutral()
  }
  const params = {
    year: String(effect.year),
    amount: formatMoney(Math.abs(effect.total)),
    months: effect.months,
  }
  const up = effect.total > 0
  switch (target) {
    case 'rental_income':
      return up
        ? m.amounts_effect_rent_up(params)
        : m.amounts_effect_rent_down(params)
    case 'expenses':
      return up
        ? m.amounts_effect_expense_up(params)
        : m.amounts_effect_expense_down(params)
    case 'acquisition_cost':
      return up
        ? m.amounts_effect_acquisition_up(params)
        : m.amounts_effect_acquisition_down(params)
  }
}

function History(props: {
  periods: readonly Period<number>[]
  onUndo: () => void
}) {
  return (
    <Stack component="section" sx={{ gap: 0.75 }}>
      <Typography variant="h4" component="h2" sx={{ fontWeight: 900 }}>
        {m.amounts_form_history()}
      </Typography>
      <Box
        component="ul"
        aria-label={m.amounts_form_history()}
        sx={{
          listStyle: 'none',
          m: 0,
          px: 2,
          bgcolor: 'background.paper',
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: `${String(radii.card)}px`,
        }}
      >
        {[...props.periods].reverse().map((p) => (
          <Box
            component="li"
            key={p.validFrom}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 52,
              '& + &': { borderTop: `1px solid ${colors.divider}` },
            }}
          >
            <Typography component="span" sx={{ fontWeight: 800 }}>
              {m.amounts_from({ date: formatDate(p.validFrom) })}
            </Typography>
            <Typography component="span" sx={{ fontWeight: 900 }}>
              {formatMoney(p.value)}
            </Typography>
          </Box>
        ))}
      </Box>
      <UndoButton onClick={props.onUndo} />
    </Stack>
  )
}

export function AmountForm(props: Props) {
  const { kind, view, propertyId } = props
  const periods = view.amounts[kind]
  const latest = periods.at(-1)
  const previous = periods.at(-2)
  const [alert, setAlert] = useState<AlertReason>()
  const [amountReason, setAmountReason] = useState<FieldReason>()
  const [dateReason, setDateReason] = useState<FieldReason>()
  const [undoing, setUndoing] = useState(false)

  const form = useForm({
    defaultValues: { amount: '', from: '' },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      setAmountReason(undefined)
      setDateReason(undefined)
      try {
        const result = await setRecurringAmount({
          data: { propertyId, kind, amount: value.amount, from: value.from },
        })
        if (result.ok) {
          await props.onDone()
        } else if (isIn(AMOUNT_REASONS, result.reason)) {
          setAmountReason(result.reason)
        } else if (isIn(DATE_REASONS, result.reason)) {
          setDateReason(result.reason)
        } else {
          setAlert(result.reason as AlertReason)
        }
      } catch (error) {
        clientLog.error('recurring_amount.save_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  const amountText = useSelector(form.store, (s) => s.values.amount)
  const fromText = useSelector(form.store, (s) => s.values.from)
  const newCents = parseDecimal(amountText, 2)
  const from = parseFiDate(fromText)
  const latestIsUpcoming = latest !== undefined && latest.validFrom > view.today
  const effect =
    latest !== undefined && newCents !== undefined && from?.endsWith('-01')
      ? yearEffect(latest.value, newCents, from)
      : undefined
  const target = from === undefined ? undefined : targetOf(kind, view, from)

  return (
    <Stack
      component="form"
      noValidate
      aria-labelledby="amount-form-title"
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
            id="amount-form-title"
            variant="h3"
            component="h1"
            sx={{ fontSize: 18, textAlign: 'center' }}
          >
            {amountFormTitle(kind, latest !== undefined)}
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
        {latest ? (
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
              {latestIsUpcoming
                ? m.amounts_form_latest_upcoming()
                : m.amounts_form_current()}
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 900 }}>
              {m.amounts_per_month({ amount: formatMoney(latest.value) })}
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
              label={latest ? m.amounts_form_new() : m.amounts_form_amount()}
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
              {effectText(target, effect)}
            </Typography>
          </Box>
        ) : null}
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
          {latest === undefined
            ? m.amounts_form_hint_first()
            : kind === 'rent'
              ? m.amounts_form_hint_rent()
              : m.amounts_form_hint_charge()}
        </Typography>
        {alert === undefined ? null : <ReasonAlert reason={alert} />}
        {latest ? (
          <History
            periods={periods}
            onUndo={() => {
              setUndoing(true)
            }}
          />
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
                : latest
                  ? m.amounts_form_save_change()
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
          title={m.amounts_undo_title({ date: formatDate(latest.validFrom) })}
          text={
            previous
              ? m.amounts_undo_text({
                  amount: formatMoney(previous.value),
                  date: formatDate(previous.validFrom),
                })
              : m.amounts_undo_only_text()
          }
          undo={() => undoRecurringAmount({ data: { propertyId, kind } })}
          failureEvent="recurring_amount.undo_failed"
          onDone={props.onDone}
        />
      ) : null}
    </Stack>
  )
}
