// Adding a usage charge and changing one (Design canvas: Lisää käyttömaksu;
// openspec: usage-charges, "Adding a usage charge", "Changing a usage
// charge", "Undoing the latest usage charge change", "Water charge entries
// are warned about"). Adding asks for the kind, the description for *other*,
// the basis, the amount and the month it starts; it shows the amount today
// with today's occupants and the form 7H row. Changing offers a new amount or
// the end, the amounts and the undo of the latest.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm, useSelector } from '@tanstack/react-form'
import { useEffect, useState } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { ChoiceField } from '#/components/form/ChoiceField'
import { TextField } from '#/components/form/TextField'
import {
  monthStartDate,
  typedAmount,
} from '#/features/recurring-amounts/schemas'
import { UndoButton } from '#/features/recurring-amounts/UndoDialog'
import { entriesSince } from '#/features/transactions/functions'
import { summaryRowLabel } from '#/features/transactions/labels'
import { defaultBasis } from '#/lib/charge-fields'
import {
  chargeBasisLabel,
  chargeKindLabel,
  chargeName,
} from '#/lib/charge-labels'
import { clientLog } from '#/lib/client-log'
import { parseFiDate } from '#/lib/dates'
import { parseDecimal } from '#/lib/decimal'
import { formatDate, formatMoney } from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { CHARGE_BASES, CHARGE_KINDS, type ChargeKind } from '#/server/db/schema'
import { colors, radii } from '#/theme/tokens'
import { addUsageCharge, setUsageCharge } from './functions'
import type { UsageChargePeriods } from './months'
import { USAGE_CHARGE_ROWS } from './rows'

interface Props {
  propertyId: string
  address: string
  /** Today's occupants, for a per-occupant amount. */
  persons: number
  /** Changing this charge; adding one when absent. */
  charge?: UsageChargePeriods
  onDone: () => Promise<void>
  onClose: () => void
  /** Changing: undoing the charge's latest change. */
  onUndo?: () => void
}

type Field = 'amount' | 'from' | 'description'

const FIELD_REASONS: Partial<Record<string, Field>> = {
  amount_invalid: 'amount',
  description_required: 'description',
  date_invalid: 'from',
  amount_date_not_month_start: 'from',
  amount_date_too_early: 'from',
  amount_date_before_ownership: 'from',
}

export function UsageChargeForm(props: Props) {
  const { charge } = props
  const [alert, setAlert] = useState<AlertReason>()
  const [reasons, setReasons] = useState<Partial<Record<Field, FieldReason>>>(
    {},
  )
  const [basisChosen, setBasisChosen] = useState(false)

  const form = useForm({
    defaultValues: {
      kind: 'water' as ChargeKind,
      description: '',
      basis: defaultBasis('water'),
      change: 'amount' as 'amount' | 'end',
      amount: '',
      from: '',
    },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      setReasons({})
      try {
        const result = charge
          ? await setUsageCharge({
              data: {
                propertyId: props.propertyId,
                chargeId: charge.id,
                amount: value.change === 'end' ? '0' : value.amount,
                from: value.from,
              },
            })
          : await addUsageCharge({
              data: {
                propertyId: props.propertyId,
                kind: value.kind,
                basis: value.basis,
                description: value.description,
                amount: value.amount,
                from: value.from,
              },
            })
        if (result.ok) {
          await props.onDone()
          return
        }
        const field = FIELD_REASONS[result.reason]
        if (field) {
          setReasons({ [field]: result.reason as FieldReason })
        } else {
          setAlert(result.reason as AlertReason)
        }
      } catch (error) {
        clientLog.error('usage_charge.save_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  const chosenKind = useSelector(form.store, (s) => s.values.kind)
  const kind = charge?.kind ?? chosenKind
  const chosenBasis = useSelector(form.store, (s) => s.values.basis)
  const basis = charge?.basis ?? chosenBasis
  const ending = useSelector(form.store, (s) => s.values.change === 'end')
  const cents = parseDecimal(
    useSelector(form.store, (s) => s.values.amount),
    2,
  )
  const from = parseFiDate(useSelector(form.store, (s) => s.values.from))

  // Water charge entries from the start date on (a water charge only).
  const [found, setFound] = useState<{
    from: string
    count: number
    total: number
  }>()
  const warnFrom = kind === 'water' && !ending ? from : undefined
  useEffect(() => {
    if (warnFrom === undefined) {
      return
    }
    let current = true
    void entriesSince({
      data: {
        propertyId: props.propertyId,
        category: 'water_charge',
        from: warnFrom,
      },
    })
      .then((result) => {
        if (current && result.ok) {
          setFound({ from: warnFrom, count: result.count, total: result.total })
        }
      })
      .catch((error: unknown) => {
        clientLog.error('usage_charge.entries_failed', {}, error)
      })
    return () => {
      current = false
    }
  }, [props.propertyId, warnFrom])
  const entries = found?.from === warnFrom ? found : undefined

  const history = [...(charge?.periods ?? [])].reverse()
  const clear = (field: Field) => () => {
    setReasons((current) => ({ ...current, [field]: undefined }))
  }

  return (
    <Stack
      component="form"
      noValidate
      aria-labelledby="usage-charge-form-title"
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
        </IconButton>
        <Stack sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography
            id="usage-charge-form-title"
            variant="h3"
            component="h1"
            sx={{ fontSize: 18, textAlign: 'center' }}
          >
            {charge ? chargeName(charge) : m.usage_charges_add()}
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
        {charge ? (
          <form.Field
            name="change"
            listeners={{
              onChange: () => {
                setReasons({})
              },
            }}
          >
            {(field) => (
              <ChoiceField
                field={field}
                label={m.amounts_charge_choice()}
                choices={[
                  { value: 'amount', label: m.amounts_charge_change_amount() },
                  { value: 'end', label: m.amounts_charge_end() },
                ]}
              />
            )}
          </form.Field>
        ) : (
          <>
            <form.Field
              name="kind"
              listeners={{
                onChange: ({ value }) => {
                  if (!basisChosen) {
                    form.setFieldValue('basis', defaultBasis(value))
                  }
                },
              }}
            >
              {(field) => (
                <ChoiceField
                  field={field}
                  label={m.usage_charge_form_kind()}
                  choices={CHARGE_KINDS.map((value) => ({
                    value,
                    label: chargeKindLabel[value](),
                  }))}
                />
              )}
            </form.Field>
            {kind === 'other' ? (
              <form.Field
                name="description"
                listeners={{ onChange: clear('description') }}
              >
                {(field) => (
                  <TextField
                    field={field}
                    reason={reasons.description}
                    label={m.tenant_fee_form_description()}
                  />
                )}
              </form.Field>
            ) : null}
            <form.Field
              name="basis"
              listeners={{
                onChange: () => {
                  setBasisChosen(true)
                },
              }}
            >
              {(field) => (
                <ChoiceField
                  field={field}
                  label={m.tenant_fee_form_basis()}
                  choices={CHARGE_BASES.map((value) => ({
                    value,
                    label: chargeBasisLabel[value](),
                  }))}
                />
              )}
            </form.Field>
          </>
        )}
        {ending ? null : (
          <form.Field
            name="amount"
            validators={{ onChange: typedAmount }}
            listeners={{ onChange: clear('amount') }}
          >
            {(field) => (
              <TextField
                field={field}
                reason={reasons.amount}
                label={
                  basis === 'per_occupant'
                    ? m.charge_amount_per_occupant()
                    : m.charge_amount_fixed()
                }
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
            )}
          </form.Field>
        )}
        {!ending && basis === 'per_occupant' && cents !== undefined ? (
          <Box
            role="status"
            sx={{
              bgcolor: colors.yellowTint,
              borderRadius: `${String(radii.input)}px`,
              px: 1.75,
              py: 1.5,
              fontWeight: 800,
            }}
          >
            {m.usage_charge_form_today({
              amount: formatMoney(cents * props.persons),
              occupants: m.occupants_count({ persons: props.persons }),
            })}
          </Box>
        ) : null}
        <form.Field
          name="from"
          validators={{ onChange: monthStartDate }}
          listeners={{ onChange: clear('from') }}
        >
          {(field) => (
            <TextField
              field={field}
              reason={reasons.from}
              label={m.amounts_form_from()}
              placeholder={m.date_placeholder()}
            />
          )}
        </form.Field>
        <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
          {m.usage_charge_form_hint()}{' '}
          {m.usage_charge_form_row({
            row: summaryRowLabel[USAGE_CHARGE_ROWS[kind]](),
          })}
        </Typography>
        {entries && entries.count > 0 && from !== undefined ? (
          <Box
            role="status"
            sx={{
              bgcolor: colors.yellowTint,
              borderRadius: `${String(radii.input)}px`,
              px: 1.75,
              py: 1.5,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {m.usage_charge_water_warning({
              date: formatDate(from),
              count: String(entries.count),
              total: formatMoney(entries.total),
            })}{' '}
            <Link
              href={`/properties/${props.propertyId}/transactions`}
              sx={{ fontWeight: 900 }}
            >
              {m.tenant_fee_water_link()}
            </Link>
          </Box>
        ) : null}
        {alert === undefined ? null : <ReasonAlert reason={alert} />}
        {charge && history.length > 0 ? (
          <Box
            component="ul"
            aria-label={m.usage_charge_amounts()}
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              borderTop: `1px solid ${colors.cardBorder}`,
            }}
          >
            {history.map((period) => (
              <Box
                component="li"
                key={period.validFrom}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  minHeight: 44,
                  alignItems: 'center',
                  '& + &': { borderTop: `1px solid ${colors.divider}` },
                }}
              >
                <Typography component="span" sx={{ fontWeight: 800 }}>
                  {m.amounts_from({ date: formatDate(period.validFrom) })}
                </Typography>
                <Typography component="span" sx={{ fontWeight: 900 }}>
                  {formatMoney(period.value)}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : null}
        {charge && props.onUndo ? <UndoButton onClick={props.onUndo} /> : null}
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
              disabled={submitting}
              sx={{ minHeight: 52 }}
            >
              {charge ? m.amounts_form_save_change() : m.usage_charges_add()}
            </Button>
          )}
        </form.Subscribe>
      </Box>
    </Stack>
  )
}
