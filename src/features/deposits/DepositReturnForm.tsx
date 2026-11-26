// Recording, correcting and deleting a deposit return (Design canvas:
// Vakuuden palautus; openspec: deposits, "Recording a deposit return",
// "Correcting and deleting a deposit return"): in full or with deductions,
// the return date, the rent and the damage kept, a note, and the amount
// returned, computed as the form changes.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm, useSelector } from '@tanstack/react-form'
import { useState } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { ChoiceField } from '#/components/form/ChoiceField'
import { TextField } from '#/components/form/TextField'
import { typedDate } from '#/features/ownership/schemas'
import { clientLog } from '#/lib/client-log'
import type { IsoDate } from '#/lib/dates'
import { parseDecimal } from '#/lib/decimal'
import {
  formatAmountInput,
  formatDate,
  formatMonth,
  formatMoney,
} from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { amountReturned, type MissingMonth } from './deposit'
import type { DepositReturn } from './deposit-return.repository.server'
import {
  deleteDepositReturn,
  recordDepositReturn,
  updateDepositReturn,
} from './functions'
import { typedKept } from './schemas'

interface Props {
  propertyId: string
  tenancyId: string
  address: string
  tenantName: string
  /** Cents. */
  deposit: number
  lastRentDay: IsoDate
  today: IsoDate
  /** Without the return's own payments, oldest first. */
  missing: readonly MissingMonth[]
  /** The recorded return; without it the form records one. */
  editing?: DepositReturn
  onSaved: () => Promise<void>
  onClose: () => void
}

type Field = 'returnedOn' | 'rentKept' | 'damageKept' | 'note'

const FIELD_OF: Partial<Record<FieldReason, Field>> = {
  deposit_return_before_end: 'returnedOn',
  deposit_return_date_in_future: 'returnedOn',
  date_invalid: 'returnedOn',
  deposit_rent_exceeds_unpaid: 'rentKept',
  deposit_kept_required: 'rentKept',
  deposit_kept_exceeds_deposit: 'damageKept',
  deposit_note_too_long: 'note',
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

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
} as const

const monthName = (month: string) => {
  const [year, number] = month.split('-').map(Number) as [number, number]
  return formatMonth(year, number)
}

function DeleteDialog(props: {
  propertyId: string
  tenancyId: string
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const [alert, setAlert] = useState<AlertReason>()
  const [busy, setBusy] = useState(false)

  async function remove() {
    setAlert(undefined)
    setBusy(true)
    try {
      const result = await deleteDepositReturn({
        data: { propertyId: props.propertyId, tenancyId: props.tenancyId },
      })
      if (result.ok) {
        await props.onDone()
      } else {
        setAlert(result.reason)
      }
    } catch (error) {
      clientLog.error('deposit.delete_failed', {}, error)
      setAlert(failureReason(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={props.onClose} aria-labelledby="delete-return-title">
      <DialogTitle
        id="delete-return-title"
        sx={{ fontSize: 20, fontWeight: 900, lineHeight: 1.3 }}
      >
        {m.deposit_return_delete_title()}
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 1.5 }}>
          <DialogContentText>
            {m.deposit_return_delete_text()}
          </DialogContentText>
          {alert === undefined ? null : <ReasonAlert reason={alert} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" color="inherit" onClick={props.onClose}>
          {m.rent_payment_cancel()}
        </Button>
        <Button
          color="error"
          disabled={busy}
          onClick={() => {
            void remove()
          }}
        >
          {m.deposit_return_delete()}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function DepositReturnForm(props: Props) {
  const { editing } = props
  const [alert, setAlert] = useState<AlertReason>()
  const [reasons, setReasons] = useState<Partial<Record<Field, FieldReason>>>(
    {},
  )
  const [deleting, setDeleting] = useState(false)
  const clear = (field: Field) => () => {
    setReasons((current) => ({ ...current, [field]: undefined }))
  }
  const hadDeductions =
    editing !== undefined && editing.rentKept + editing.damageKept > 0

  const form = useForm({
    defaultValues: {
      how: hadDeductions ? 'deductions' : 'full',
      returnedOn: formatDate(editing?.returnedOn ?? props.today),
      rentKept:
        editing && editing.rentKept > 0
          ? formatAmountInput(editing.rentKept)
          : '',
      damageKept:
        editing && editing.damageKept > 0
          ? formatAmountInput(editing.damageKept)
          : '',
      note: editing?.note ?? '',
    },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      setReasons({})
      const data = {
        propertyId: props.propertyId,
        tenancyId: props.tenancyId,
        returnedOn: value.returnedOn,
        deductions: value.how === 'deductions',
        rentKept: value.rentKept,
        damageKept: value.damageKept,
        note: value.note,
      }
      try {
        const result = editing
          ? await updateDepositReturn({ data })
          : await recordDepositReturn({ data })
        if (result.ok) {
          await props.onSaved()
          return
        }
        const field = FIELD_OF[result.reason as FieldReason]
        if (field) {
          setReasons({ [field]: result.reason as FieldReason })
        } else {
          setAlert(result.reason as AlertReason)
        }
      } catch (error) {
        clientLog.error('deposit.save_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  const deductions =
    useSelector(form.store, (s) => s.values.how) === 'deductions'
  const rentKept = parseDecimal(
    useSelector(form.store, (s) => s.values.rentKept) || '0',
    2,
  )
  const damageKept = parseDecimal(
    useSelector(form.store, (s) => s.values.damageKept) || '0',
    2,
  )
  const returned = !deductions
    ? props.deposit
    : rentKept === undefined || damageKept === undefined
      ? undefined
      : amountReturned(props.deposit, { rentKept, damageKept })

  return (
    <Stack
      component="form"
      noValidate
      aria-labelledby="deposit-return-title"
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
            id="deposit-return-title"
            variant="h3"
            component="h1"
            sx={{ fontSize: 18, textAlign: 'center' }}
          >
            {m.deposit_return_title()}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {props.address}
          </Typography>
        </Stack>
      </Box>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 2.25, px: 2.5, pt: 1.25, pb: 2.5 }}
      >
        <Box component="dl" sx={{ ...card, m: 0, px: 2, py: 0.5 }}>
          {[
            [m.tenancy_form_name(), props.tenantName],
            [m.deposit_return_deposit(), formatMoney(props.deposit)],
            [m.deposit_return_last_day(), formatDate(props.lastRentDay)],
          ].map(([label, value], i) => (
            <Stack
              key={label}
              direction="row"
              sx={{
                justifyContent: 'space-between',
                gap: 1.5,
                minHeight: 44,
                alignItems: 'center',
                borderTop: i === 0 ? 'none' : `1px solid ${colors.divider}`,
              }}
            >
              <Typography
                component="dt"
                variant="body2"
                sx={{ fontWeight: 800, color: 'text.secondary' }}
              >
                {label}
              </Typography>
              <Typography
                component="dd"
                sx={{ m: 0, fontSize: 14, fontWeight: 900 }}
              >
                {value}
              </Typography>
            </Stack>
          ))}
        </Box>
        <form.Field name="how">
          {(field) => (
            <ChoiceField
              field={field}
              label={m.deposit_return_how()}
              choices={[
                { value: 'full', label: m.deposit_return_full() },
                { value: 'deductions', label: m.deposit_return_deductions() },
              ]}
            />
          )}
        </form.Field>
        <form.Field
          name="returnedOn"
          validators={{ onChange: typedDate }}
          listeners={{ onChange: clear('returnedOn') }}
        >
          {(field) => (
            <TextField
              field={field}
              reason={reasons.returnedOn}
              label={m.deposit_return_date()}
              placeholder={m.date_placeholder()}
            />
          )}
        </form.Field>
        {deductions ? (
          <>
            <form.Field
              name="rentKept"
              validators={{ onChange: typedKept }}
              listeners={{ onChange: clear('rentKept') }}
            >
              {(field) => (
                <TextField
                  field={field}
                  reason={reasons.rentKept}
                  label={m.deposit_return_rent_kept()}
                  slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                />
              )}
            </form.Field>
            <Stack sx={{ gap: 0.5, mt: -1 }}>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                {m.deposit_return_missing_title()}
              </Typography>
              {props.missing.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {m.deposit_return_nothing_missing()}
                </Typography>
              ) : (
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {props.missing.map((row) => (
                    <Typography
                      key={row.month}
                      component="li"
                      variant="body2"
                      color="text.secondary"
                    >
                      {m.deposit_return_missing_line({
                        month: monthName(row.month),
                        amount: formatMoney(row.missing),
                      })}
                    </Typography>
                  ))}
                </Box>
              )}
              <Typography variant="body2" color="text.secondary">
                {m.deposit_return_rent_hint()}
              </Typography>
            </Stack>
            <form.Field
              name="damageKept"
              validators={{ onChange: typedKept }}
              listeners={{ onChange: clear('damageKept') }}
            >
              {(field) => (
                <TextField
                  field={field}
                  reason={reasons.damageKept}
                  label={m.deposit_return_damage_kept()}
                  slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                />
              )}
            </form.Field>
            <form.Field name="note" listeners={{ onChange: clear('note') }}>
              {(field) => (
                <TextField
                  field={field}
                  reason={reasons.note}
                  label={m.deposit_return_note()}
                  multiline
                  minRows={2}
                />
              )}
            </form.Field>
          </>
        ) : null}
        <Stack
          role="status"
          direction="row"
          sx={{
            ...card,
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1.5,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 800 }}>
            {m.deposit_return_amount()}
          </Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 900 }}>
            {returned === undefined ? '' : formatMoney(returned)}
          </Typography>
        </Stack>
        {alert === undefined ? null : <ReasonAlert reason={alert} />}
        {editing ? (
          <Button
            variant="text"
            color="error"
            onClick={() => {
              setDeleting(true)
            }}
            sx={{ alignSelf: 'center', minHeight: 44 }}
          >
            {m.deposit_return_delete()}
          </Button>
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
              {m.deposit_return_save()}
            </Button>
          )}
        </form.Subscribe>
      </Box>
      {deleting ? (
        <DeleteDialog
          propertyId={props.propertyId}
          tenancyId={props.tenancyId}
          onClose={() => {
            setDeleting(false)
          }}
          onDone={async () => {
            setDeleting(false)
            await props.onSaved()
          }}
        />
      ) : null}
    </Stack>
  )
}
