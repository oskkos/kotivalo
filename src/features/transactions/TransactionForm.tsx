// Logging an income or an expense (Design canvas: "Uusi kirjaus", "· kuitti
// liitetty", "· tallennetaan", "· virheet"): the type, amount, category with
// its tax hint, date, note and an optional receipt, sent together as form
// data (openspec: transactions, "Logging an entry", "Attaching a receipt").
// Opened from a flat's Entries page the flat is fixed; from the bottom bar
// the user picks one of the flats they own.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import FormHelperText from '@mui/material/FormHelperText'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm, useSelector } from '@tanstack/react-form'
import { useId, useRef, useState } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { TextField } from '#/components/form/TextField'
import type { Property } from '#/features/properties/property'
import { clientLog } from '#/lib/client-log'
import { parseFiDate, type IsoDate } from '#/lib/dates'
import { formatDate, formatFileSize } from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import { reasonText, type AlertReason, type FieldReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import type { TransactionCategory, TransactionType } from '#/server/db/schema'
import { colors, radii } from '#/theme/tokens'
import { CATEGORIES, categoriesOf } from './categories'
import { createTransaction } from './functions'
import { categoryLabel } from './labels'
import { prepareReceipt, RECEIPT_ACCEPT, ReceiptProblem } from './resize-image'
import { typedNote, typedTransactionAmount } from './schemas'

interface Props {
  /** The flats the entry can be for; one means it's fixed. */
  flats: readonly Property[]
  /** The flat chosen at first. */
  initialFlatId: string
  /** Whether the user may pick the flat (opened from the bottom bar). */
  pickFlat: boolean
  today: IsoDate
  /** After saving: reload and go to the flat's entries for that year. */
  onSaved: (saved: { propertyId: string; date: IsoDate }) => Promise<void>
  onClose: () => void
}

export const CATEGORY_HINTS: Record<TransactionCategory, () => string> = {
  tenant_water_charge: () => m.transactions_hint_tenant_water_charge(),
  other_income: () => m.transactions_hint_other_income(),
  annual_repair: () => m.transactions_hint_annual_repair(),
  water_charge: () => m.transactions_hint_water_charge(),
  insurance: () => m.transactions_hint_insurance(),
  other_expense: () => m.transactions_hint_other_expense(),
}

const FIELD_OF: Partial<
  Record<FieldReason, 'amount' | 'category' | 'date' | 'note' | 'receipt'>
> = {
  transaction_amount_invalid: 'amount',
  transaction_category_invalid: 'category',
  date_invalid: 'date',
  transaction_date_in_future: 'date',
  transaction_date_before_ownership: 'date',
  transaction_note_too_long: 'note',
  receipt_unsupported_type: 'receipt',
  receipt_too_large: 'receipt',
  receipt_unreadable: 'receipt',
}

type FieldName = 'amount' | 'category' | 'date' | 'note' | 'receipt'

function Icon(props: { path: string; size?: number; width?: number }) {
  const size = props.size ?? 22
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={props.width ?? 2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={props.path} />
    </svg>
  )
}

const CLOSE = 'M6 6 L18 18 M18 6 L6 18'
const CAMERA =
  'M4 8 H7 L9 5 H15 L17 8 H20 V19 H4 Z M15.2 13 a3.2 3.2 0 1 1 -6.4 0 a3.2 3.2 0 1 1 6.4 0'
const CHECK = 'M5 12 L10 17 L19 7'
const CHEVRON = 'M9 5 L16 12 L9 19'

function FieldReasonText(props: {
  id: string
  reason: FieldReason | undefined
}) {
  return props.reason === undefined ? null : (
    <FormHelperText id={props.id} error>
      {reasonText(props.reason).text}
    </FormHelperText>
  )
}

/** The flat choice in a dialog: the owned flats, by street address. */
function FlatPicker(props: {
  flats: readonly Property[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const current = props.flats.find((flat) => flat.id === props.value)
  return (
    <>
      <ButtonBase
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true)
        }}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 1.5,
          minHeight: 52,
          px: 2,
          borderBottom: `1px solid ${colors.divider}`,
          width: '100%',
          fontFamily: 'inherit',
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, color: 'text.secondary' }}
        >
          {m.transactions_flat()}
        </Typography>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontWeight: 800 }}>
            {current?.streetAddress}
          </Typography>
          <Icon path={CHEVRON} size={18} />
        </Stack>
      </ButtonBase>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
        }}
        aria-labelledby={titleId}
        fullWidth
      >
        <DialogTitle id={titleId} sx={{ fontSize: 20, fontWeight: 900 }}>
          {m.transactions_choose_flat()}
        </DialogTitle>
        <Stack
          role="radiogroup"
          aria-labelledby={titleId}
          sx={{ px: 2, pb: 1 }}
        >
          {props.flats.map((flat) => {
            const checked = flat.id === props.value
            return (
              <ButtonBase
                key={flat.id}
                role="radio"
                aria-checked={checked}
                onClick={() => {
                  props.onChange(flat.id)
                  setOpen(false)
                }}
                sx={{
                  justifyContent: 'flex-start',
                  gap: 1.5,
                  minHeight: 56,
                  px: 1,
                  borderRadius: `${String(radii.input)}px`,
                  fontFamily: 'inherit',
                }}
              >
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '11px',
                    border: `2px solid ${colors.plum}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {checked ? (
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '5px',
                        bgcolor: colors.plum,
                      }}
                    />
                  ) : null}
                </Box>
                <Stack sx={{ alignItems: 'flex-start' }}>
                  <Typography sx={{ fontWeight: 900 }}>
                    {flat.streetAddress}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {flat.city}
                  </Typography>
                </Stack>
              </ButtonBase>
            )
          })}
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ px: 3, pb: 3 }}
        >
          {m.transactions_choose_flat_note()}
        </Typography>
      </Dialog>
    </>
  )
}

export function TransactionForm(props: Props) {
  const [flatId, setFlatId] = useState(props.initialFlatId)
  const [receipt, setReceipt] = useState<File>()
  const [reasons, setReasons] = useState<
    Partial<Record<FieldName, FieldReason>>
  >({})
  const [alert, setAlert] = useState<AlertReason>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const categoryId = useId()
  const receiptId = useId()
  const flat = props.flats.find((candidate) => candidate.id === flatId)

  const clearReason = (name: FieldName) => {
    setReasons((current) => ({ ...current, [name]: undefined }))
  }

  const form = useForm({
    defaultValues: {
      type: 'expense' as TransactionType,
      category: 'annual_repair' as TransactionCategory,
      amount: '',
      date: formatDate(props.today),
      note: '',
    },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      setReasons({})
      const date = parseFiDate(value.date)
      // The server checks the ownership start too; the form knows today.
      const dateProblem =
        date === undefined
          ? 'date_invalid'
          : date > props.today
            ? 'transaction_date_in_future'
            : undefined
      if (dateProblem) {
        setReasons({ date: dateProblem })
        return
      }
      const data = new FormData()
      data.set('propertyId', flatId)
      data.set('type', value.type)
      data.set('category', value.category)
      data.set('amount', value.amount)
      data.set('date', value.date)
      data.set('note', value.note)
      try {
        if (receipt) {
          data.set('receipt', await prepareReceipt(receipt))
        }
        const result = await createTransaction({ data })
        if (result.ok) {
          await props.onSaved({ propertyId: flatId, date: date ?? props.today })
          return
        }
        const field = FIELD_OF[result.reason as FieldReason]
        if (field) {
          setReasons({ [field]: result.reason })
        } else {
          setAlert(result.reason as AlertReason)
        }
      } catch (error) {
        if (error instanceof ReceiptProblem) {
          setReasons({ receipt: error.reason })
          return
        }
        clientLog.error('transaction.save_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  const type = useSelector(form.store, (s) => s.values.type)
  const category = useSelector(form.store, (s) => s.values.category)
  const submitting = useSelector(form.store, (s) => s.isSubmitting)
  const income = type === 'income'

  return (
    <Stack
      component="form"
      noValidate
      aria-labelledby="transaction-form-title"
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
        <IconButton aria-label={m.transactions_close()} onClick={props.onClose}>
          <Icon path={CLOSE} width={2.6} />
        </IconButton>
        <Stack sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography
            id="transaction-form-title"
            variant="h3"
            component="h1"
            sx={{ fontSize: 18 }}
          >
            {m.transactions_new()}
          </Typography>
          {props.pickFlat ? null : (
            <Typography variant="body2" color="text.secondary" noWrap>
              {flat?.streetAddress}
            </Typography>
          )}
        </Stack>
      </Box>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 1.75, px: 2.5, pt: 1, pb: 2.5 }}
      >
        <form.Field name="type">
          {(field) => (
            <Box
              role="group"
              aria-label={m.transactions_type()}
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 0.5,
                bgcolor: colors.sand,
                borderRadius: 999,
                p: 0.5,
              }}
            >
              {(['income', 'expense'] as const).map((option) => {
                const pressed = field.state.value === option
                return (
                  <Button
                    key={option}
                    type="button"
                    aria-pressed={pressed}
                    disabled={submitting}
                    onClick={() => {
                      field.handleChange(option)
                      form.setFieldValue(
                        'category',
                        categoriesOf(option)[0] ?? 'other_expense',
                      )
                      clearReason('category')
                    }}
                    sx={{
                      minHeight: 44,
                      borderRadius: 999,
                      fontSize: 15,
                      fontWeight: 900,
                      color: 'text.primary',
                      bgcolor: pressed ? colors.yellow : 'transparent',
                      '&:hover': {
                        bgcolor: pressed ? colors.yellow : colors.cardBorder,
                      },
                    }}
                  >
                    {option === 'income'
                      ? m.transactions_type_income()
                      : m.transactions_type_expense()}
                  </Button>
                )
              })}
            </Box>
          )}
        </form.Field>
        <form.Field
          name="amount"
          validators={{ onChange: typedTransactionAmount }}
          listeners={{
            onChange: () => {
              clearReason('amount')
            },
          }}
        >
          {(field) => (
            <TextField
              field={field}
              reason={reasons.amount}
              label={m.transactions_amount()}
              placeholder={m.transactions_amount_placeholder()}
              slotProps={{
                htmlInput: {
                  inputMode: 'decimal',
                  style: { fontSize: 28, fontWeight: 900 },
                },
                input: {
                  endAdornment: (
                    <Typography sx={{ fontSize: 24, fontWeight: 900 }}>
                      €
                    </Typography>
                  ),
                },
              }}
            />
          )}
        </form.Field>
        <Stack
          role="group"
          aria-labelledby={categoryId}
          aria-describedby={
            reasons.category ? `${categoryId}-reason` : undefined
          }
          sx={{ gap: 1 }}
        >
          <Typography
            id={categoryId}
            variant="h4"
            component="h2"
            sx={{ fontSize: 14, fontWeight: 900 }}
          >
            {m.transactions_category()}
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
            {categoriesOf(type).map((option) => {
              const pressed = option === category
              return (
                <Button
                  key={option}
                  type="button"
                  variant="outlined"
                  aria-pressed={pressed}
                  disabled={submitting}
                  onClick={() => {
                    form.setFieldValue('category', option)
                    clearReason('category')
                  }}
                  sx={{
                    minHeight: 44,
                    borderRadius: 999,
                    px: 2,
                    fontSize: 14,
                    fontWeight: 800,
                    ...(pressed
                      ? {
                          bgcolor: 'primary.main',
                          borderColor: 'primary.main',
                          color: 'primary.contrastText',
                          '&:hover': { bgcolor: 'primary.main' },
                        }
                      : {}),
                  }}
                >
                  {categoryLabel[option]()}
                </Button>
              )
            })}
          </Stack>
          <FieldReasonText
            id={`${categoryId}-reason`}
            reason={reasons.category}
          />
        </Stack>
        <Stack
          role="status"
          sx={{
            gap: 0.75,
            bgcolor: colors.yellowTint,
            borderRadius: `${String(radii.tile)}px`,
            px: 1.75,
            py: 1.5,
          }}
        >
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
            <Icon path={CHECK} size={16} width={3} />
            <Typography sx={{ fontSize: 13, fontWeight: 900 }}>
              {CATEGORIES[category].type === 'income'
                ? m.transactions_hint_taxable()
                : m.transactions_hint_deductible()}
            </Typography>
          </Stack>
          <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>
            {CATEGORY_HINTS[category]()}
          </Typography>
        </Stack>
        <Stack
          sx={{
            bgcolor: 'background.paper',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: `${String(radii.card)}px`,
            overflow: 'hidden',
          }}
        >
          {props.pickFlat ? (
            <FlatPicker
              flats={props.flats}
              value={flatId}
              onChange={setFlatId}
            />
          ) : null}
          <Stack sx={{ gap: 1.5, p: 2 }}>
            <form.Field
              name="date"
              listeners={{
                onChange: () => {
                  clearReason('date')
                },
              }}
            >
              {(field) => (
                <TextField
                  field={field}
                  reason={reasons.date}
                  label={m.transactions_date()}
                  placeholder={m.date_placeholder()}
                />
              )}
            </form.Field>
            <form.Field
              name="note"
              validators={{ onChange: typedNote }}
              listeners={{
                onChange: () => {
                  clearReason('note')
                },
              }}
            >
              {(field) => (
                <TextField
                  field={field}
                  reason={reasons.note}
                  label={m.transactions_note()}
                  placeholder={m.transactions_note_placeholder()}
                />
              )}
            </form.Field>
          </Stack>
        </Stack>
        <Stack
          component="section"
          aria-labelledby={receiptId}
          sx={{ gap: 0.75 }}
        >
          <Typography
            id={receiptId}
            variant="h4"
            component="h2"
            sx={{ fontSize: 14, fontWeight: 900 }}
          >
            {m.transactions_receipt()}
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            accept={RECEIPT_ACCEPT}
            hidden
            aria-label={m.transactions_attach()}
            onChange={(e) => {
              const chosen = e.target.files?.[0]
              if (chosen) {
                setReceipt(chosen)
                clearReason('receipt')
              }
              e.target.value = ''
            }}
          />
          {receipt ? (
            <Stack
              direction="row"
              sx={{
                alignItems: 'center',
                gap: 1.5,
                bgcolor: 'background.paper',
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: `${String(radii.tile)}px`,
                py: 1.25,
                pl: 1.75,
                pr: 1,
              }}
            >
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 14, fontWeight: 900 }}>
                  {receipt.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {submitting
                    ? m.transactions_saving()
                    : formatFileSize(receipt.size)}
                </Typography>
              </Stack>
              <IconButton
                aria-label={m.transactions_remove_receipt()}
                disabled={submitting}
                onClick={() => {
                  setReceipt(undefined)
                }}
              >
                <Icon path={CLOSE} size={20} />
              </IconButton>
            </Stack>
          ) : (
            <ButtonBase
              aria-describedby={
                reasons.receipt ? `${receiptId}-reason` : undefined
              }
              onClick={() => fileInputRef.current?.click()}
              sx={{
                flexDirection: 'column',
                gap: 0.25,
                minHeight: 64,
                border: `1.5px dashed ${reasons.receipt ? colors.error : colors.dashed}`,
                borderRadius: `${String(radii.tile)}px`,
                fontFamily: 'inherit',
              }}
            >
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                <Icon path={CAMERA} size={20} width={2.2} />
                <Typography sx={{ fontSize: 15, fontWeight: 800 }}>
                  {m.transactions_attach()}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {m.transactions_attach_hint()}
              </Typography>
            </ButtonBase>
          )}
          <FieldReasonText
            id={`${receiptId}-reason`}
            reason={reasons.receipt}
          />
        </Stack>
        {alert === undefined ? null : <ReasonAlert reason={alert} />}
      </Stack>
      <Box
        component="footer"
        sx={{
          position: 'sticky',
          bottom: 0,
          bgcolor: 'background.default',
          px: 2.5,
          pt: 1.5,
          pb: 3.5,
          borderTop: `1px solid ${colors.cardBorder}`,
        }}
      >
        <Button
          type="submit"
          fullWidth
          loading={submitting}
          sx={{ minHeight: 56, borderRadius: 999, fontSize: 17 }}
        >
          {income
            ? m.transactions_save_income()
            : m.transactions_save_expense()}
        </Button>
      </Box>
    </Stack>
  )
}
