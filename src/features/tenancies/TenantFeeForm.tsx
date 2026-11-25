// Adding a tenant fee and changing one (Design canvas: Lisää maksu vuokran
// lisäksi; openspec: tenancies, "Adding a tenant fee", "Changing a tenant
// fee", "Undoing a tenant fee change"). Adding asks for the kind, the
// description for *other*, the basis, the amount and the start; it shows the
// month's total the tenant pays from then on and warns about the flat's
// tenant water charge entries. Changing offers a new amount or the fee's end,
// its amounts and the undo of the latest.
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
import { typedDate } from '#/features/ownership/schemas'
import { monthOf, type Period } from '#/features/recurring-amounts/periods'
import { typedAmount } from '#/features/recurring-amounts/schemas'
import { UndoButton } from '#/features/recurring-amounts/UndoDialog'
import { entriesSince } from '#/features/transactions/functions'
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
import { CHARGE_BASES, CHARGE_KINDS } from '#/server/db/schema'
import type { ChargeKind } from '#/server/db/schema'
import { colors, radii } from '#/theme/tokens'
import { addTenantFee, setTenantFee } from './functions'
import { feeInMonth, occupantsInMonth, type FeeOfTenancy } from './fees'
import { rentInMonth } from './rent'
import type { Tenancy } from './tenancy.repository.server'

interface Props {
  propertyId: string
  address: string
  tenancy: Tenancy
  rents: readonly Period<number>[]
  occupants: readonly Period<number>[]
  /** The tenancy's fees: the others' amounts count in the total. */
  fees: readonly FeeOfTenancy[]
  /** Changing this fee; adding one when absent. */
  fee?: FeeOfTenancy
  onDone: () => Promise<void>
  onClose: () => void
  /** Changing: undoing the latest change of the fee. */
  onUndo?: () => void
}

const FIELD_REASONS: Partial<
  Record<string, 'amount' | 'from' | 'description'>
> = {
  amount_invalid: 'amount',
  description_required: 'description',
  date_invalid: 'from',
  amount_date_not_month_start: 'from',
  amount_date_too_early: 'from',
  rent_date_before_tenancy: 'from',
  rent_date_after_tenancy: 'from',
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

export function TenantFeeForm(props: Props) {
  const { tenancy, fee } = props
  const changing = fee !== undefined
  const [alert, setAlert] = useState<AlertReason>()
  const [reasons, setReasons] = useState<
    Partial<Record<'amount' | 'from' | 'description', FieldReason>>
  >({})
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
        const result = fee
          ? await setTenantFee({
              data: {
                propertyId: props.propertyId,
                tenancyId: tenancy.id,
                feeId: fee.id,
                amount: value.change === 'end' ? '0' : value.amount,
                from: value.from,
              },
            })
          : await addTenantFee({
              data: {
                propertyId: props.propertyId,
                tenancyId: tenancy.id,
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
        clientLog.error('tenancy.fee_save_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  const kind = useSelector(form.store, (s) => s.values.kind)
  const basis = useSelector(form.store, (s) => s.values.basis)
  const ending = useSelector(form.store, (s) => s.values.change === 'end')
  const amountText = useSelector(form.store, (s) => s.values.amount)
  const from = parseFiDate(useSelector(form.store, (s) => s.values.from))
  const cents = parseDecimal(amountText, 2)

  // The month's total the tenant pays from the chosen date, the new fee
  // included (adding only).
  const month = from === undefined ? undefined : monthOf(from)
  const rent =
    month === undefined ? undefined : rentInMonth(props.rents, tenancy, month)
  const others =
    month === undefined
      ? 0
      : props.fees
          .filter((other) => other.id !== fee?.id)
          .reduce(
            (sum, other) =>
              sum + (feeInMonth(other, props.occupants, tenancy, month) ?? 0),
            0,
          )
  const own =
    month === undefined || cents === undefined
      ? undefined
      : ending
        ? 0
        : cents *
          ((fee?.basis ?? basis) === 'per_occupant'
            ? (occupantsInMonth(props.occupants, tenancy, month) ?? 1)
            : 1)
  const total =
    rent === undefined || own === undefined ? undefined : rent + others + own

  // Tenant water charge entries from the start date on (adding a water fee).
  const [found, setFound] = useState<{
    from: string
    count: number
    total: number
  }>()
  const warnFrom = !changing && kind === 'water' ? from : undefined
  useEffect(() => {
    if (warnFrom === undefined) {
      return
    }
    let current = true
    void entriesSince({
      data: {
        propertyId: props.propertyId,
        category: 'tenant_water_charge',
        from: warnFrom,
      },
    })
      .then((result) => {
        if (current && result.ok) {
          setFound({ from: warnFrom, count: result.count, total: result.total })
        }
      })
      .catch((error: unknown) => {
        clientLog.error('tenancy.fee_entries_failed', {}, error)
      })
    return () => {
      current = false
    }
  }, [props.propertyId, warnFrom])

  // Only what was found for the date now entered.
  const entries = found?.from === warnFrom ? found : undefined
  const history = [...(fee?.amounts ?? [])].reverse()
  const clear = (field: 'amount' | 'from' | 'description') => () => {
    setReasons((current) => ({ ...current, [field]: undefined }))
  }

  return (
    <Stack
      component="form"
      noValidate
      aria-labelledby="fee-form-title"
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
            id="fee-form-title"
            variant="h3"
            component="h1"
            sx={{ fontSize: 18, textAlign: 'center' }}
          >
            {fee ? chargeName(fee) : m.tenant_fee_form_title_add()}
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
        {fee ? null : (
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
                  label={m.tenant_fee_form_kind()}
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
        {fee ? (
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
        ) : null}
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
                  (fee?.basis ?? basis) === 'per_occupant'
                    ? m.charge_amount_per_occupant()
                    : m.charge_amount_fixed()
                }
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
            )}
          </form.Field>
        )}
        <form.Field
          name="from"
          validators={{ onChange: typedDate }}
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
          {m.tenant_fee_form_hint()}
        </Typography>
        {total !== undefined && from !== undefined ? (
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
            {m.tenant_fee_form_total({
              date: formatDate(from),
              amount: formatMoney(total),
            })}
          </Box>
        ) : null}
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
            {m.tenant_fee_water_warning({
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
        {fee && history.length > 0 ? (
          <Box
            component="ul"
            aria-label={m.tenant_fee_amounts()}
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
        {fee && props.onUndo ? <UndoButton onClick={props.onUndo} /> : null}
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
              {fee ? m.amounts_form_save_change() : m.tenant_fee_form_save()}
            </Button>
          )}
        </form.Subscribe>
      </Box>
    </Stack>
  )
}
