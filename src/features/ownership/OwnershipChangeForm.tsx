// The ownership change form (Design canvas: OmistusMuutos): a share for
// everyone with access, quick choices, the date and the reason, and removing
// the access of people going to 0 % (spec: "Changing a flat's ownership").
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm, useSelector } from '@tanstack/react-form'
import { useState } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { TextField } from '#/components/form/TextField'
import type { Person } from '#/features/sharing/sharing.repository.server'
import { clientLog } from '#/lib/client-log'
import { parseFiDate } from '#/lib/dates'
import { formatDate, formatPercentNumber, formatShare } from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { OWNERSHIP_REASONS, type OwnershipReason } from '#/server/db/schema'
import { colors, radii } from '#/theme/tokens'
import { changeOwnership } from './functions'
import { displayName, reasonLabel, splitText } from './labels'
import { equalSplit, parsePercent, WHOLE, type Share } from './periods'
import { typedDate, typedPercent } from './schemas'

interface Props {
  propertyId: string
  /** Everyone with access, who can be in the split. */
  people: readonly Person[]
  names: Readonly<Record<string, string>>
  you: string
  /** The current split, to start from. */
  current: readonly Share[]
  onSaved: () => Promise<void>
  onCancel: () => void
}

interface Values {
  shares: { userId: string; percent: string }[]
  from: string
  reason: OwnershipReason
  removeAccess: string[]
}

const DATE_REASONS = [
  'date_invalid',
  'ownership_date_too_early',
  'ownership_date_in_future',
] as const
const TOTAL_REASONS = ['ownership_shares_total', 'ownership_no_owner'] as const

type DateReason = (typeof DATE_REASONS)[number]
type TotalReason = (typeof TOTAL_REASONS)[number]

const isIn = <T extends string>(
  list: readonly T[],
  value: string,
): value is T => (list as readonly string[]).includes(value)

export function OwnershipChangeForm({
  propertyId,
  people,
  names,
  you,
  current,
  onSaved,
  onCancel,
}: Props) {
  const [alert, setAlert] = useState<AlertReason>()
  const [fromReason, setFromReason] = useState<DateReason>()
  const [totalReason, setTotalReason] = useState<TotalReason>()
  const shareOf = new Map(current.map((s) => [s.userId, s.share]))
  // You first, then the others in the order they joined.
  const ordered = [...people].sort(
    (a, b) => Number(b.userId === you) - Number(a.userId === you),
  )

  const defaultValues: Values = {
    shares: ordered.map((p) => ({
      userId: p.userId,
      percent: formatPercentNumber(shareOf.get(p.userId) ?? 0),
    })),
    from: '',
    reason: 'sale',
    removeAccess: [],
  }
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      setFromReason(undefined)
      setTotalReason(undefined)
      const split = value.shares.map((s) => ({
        userId: s.userId,
        share: parsePercent(s.percent) ?? 0,
      }))
      const zero = new Set(
        split.filter((s) => s.share === 0).map((s) => s.userId),
      )
      try {
        const result = await changeOwnership({
          data: {
            propertyId,
            from: value.from,
            reason: value.reason,
            shares: value.shares,
            removeAccess: value.removeAccess.filter((id) => zero.has(id)),
          },
        })
        if (result.ok) {
          await onSaved()
        } else if (isIn(DATE_REASONS, result.reason)) {
          setFromReason(result.reason)
        } else if (isIn(TOTAL_REASONS, result.reason)) {
          setTotalReason(result.reason)
        } else {
          setAlert(result.reason as AlertReason)
        }
      } catch (error) {
        clientLog.error('ownership.change_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  const shares = useSelector(form.store, (s) => s.values.shares)
  const from = useSelector(form.store, (s) => s.values.from)
  const parsed = shares.map((s) => ({
    userId: s.userId,
    share: parsePercent(s.percent) ?? 0,
  }))
  const total = parsed.reduce((sum, s) => sum + s.share, 0)
  const fromDate = parseFiDate(from)
  const setShares = (split: readonly Share[]) => {
    const by = new Map(split.map((s) => [s.userId, s.share]))
    form.setFieldValue(
      'shares',
      shares.map((s) => ({
        userId: s.userId,
        percent: formatPercentNumber(by.get(s.userId) ?? 0),
      })),
    )
    setTotalReason(undefined)
  }

  return (
    <Stack
      component="form"
      noValidate
      aria-labelledby="ownership-form-title"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      sx={{
        gap: 1.5,
        p: 2,
        bgcolor: 'background.paper',
        border: `2px solid ${colors.plum}`,
        borderRadius: `${String(radii.card)}px`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography
          id="ownership-form-title"
          variant="h4"
          component="h2"
          sx={{ fontWeight: 900 }}
        >
          {m.ownership_form_title()}
        </Typography>
        <Button
          variant="text"
          color="inherit"
          onClick={onCancel}
          sx={{ textDecoration: 'underline' }}
        >
          {m.ownership_form_cancel()}
        </Button>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        <Button
          variant="outlined"
          color="inherit"
          size="small"
          onClick={() => {
            setShares([{ userId: you, share: WHOLE }])
          }}
        >
          {m.ownership_preset_all_to_me()}
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          size="small"
          onClick={() => {
            setShares(equalSplit(shares.map((s) => s.userId)))
          }}
        >
          {m.ownership_preset_equal()}
        </Button>
      </Box>
      <Stack sx={{ gap: 1 }}>
        {shares.map((s, i) => {
          const name = displayName(s.userId, names, you)
          return (
            <form.Field
              key={s.userId}
              name={
                `shares[${String(i)}].percent` as `shares[${number}].percent`
              }
              validators={{ onChange: typedPercent }}
              listeners={{
                onChange: () => {
                  setTotalReason(undefined)
                },
              }}
            >
              {(field) => (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 112px',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <Typography
                    component="span"
                    sx={{ fontWeight: 900, overflowWrap: 'anywhere' }}
                  >
                    {name}
                  </Typography>
                  <TextField
                    field={field}
                    label={m.ownership_share_label({ name })}
                    slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                  />
                </Box>
              )}
            </form.Field>
          )
        })}
      </Stack>
      {total === WHOLE && totalReason === undefined ? (
        <Typography variant="body2" color="text.secondary">
          {m.ownership_total_ok()}
        </Typography>
      ) : (
        <Typography
          variant="body2"
          role="status"
          sx={{ color: colors.error, fontWeight: 800 }}
        >
          {totalReason === 'ownership_no_owner'
            ? m.reason_ownership_no_owner()
            : m.ownership_total_wrong({ total: formatShare(total) })}
        </Typography>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 1.25,
        }}
      >
        <form.Field
          name="from"
          validators={{ onChange: typedDate }}
          listeners={{
            onChange: () => {
              setFromReason(undefined)
            },
          }}
        >
          {(field) => (
            <TextField
              field={field}
              reason={fromReason}
              label={m.ownership_from()}
              placeholder={m.date_placeholder()}
            />
          )}
        </form.Field>
        <form.Field name="reason">
          {(field) => (
            <TextField field={field} label={m.ownership_reason()} select>
              {OWNERSHIP_REASONS.map((reason) => (
                <MenuItem key={reason} value={reason}>
                  {reasonLabel(reason)}
                </MenuItem>
              ))}
            </TextField>
          )}
        </form.Field>
      </Box>
      <form.Field name="removeAccess">
        {(field) =>
          parsed
            .filter((s) => s.share === 0 && s.userId !== you)
            .map((s) => {
              const name = displayName(s.userId, names, you)
              const checked = field.state.value.includes(s.userId)
              return (
                <FormControlLabel
                  key={s.userId}
                  sx={{ alignItems: 'flex-start', m: 0 }}
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={() => {
                        field.handleChange(
                          checked
                            ? field.state.value.filter((id) => id !== s.userId)
                            : [...field.state.value, s.userId],
                        )
                      }}
                      sx={{ mt: -0.75 }}
                    />
                  }
                  label={
                    <Stack>
                      <Typography sx={{ fontWeight: 900 }}>
                        {m.ownership_remove_access({ name })}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {m.ownership_remove_access_hint()}
                      </Typography>
                    </Stack>
                  }
                />
              )
            })
        }
      </form.Field>
      {total === WHOLE && fromDate !== undefined ? (
        <Stack
          sx={{
            gap: 0.25,
            px: 1.75,
            py: 1.25,
            bgcolor: colors.yellowTint,
            borderRadius: `${String(radii.input)}px`,
          }}
        >
          <Typography sx={{ fontWeight: 900 }}>
            {m.ownership_preview({
              date: formatDate(fromDate),
              split: splitText(parsed, names, you),
            })}
          </Typography>
          <Typography variant="body2">{m.ownership_preview_hint()}</Typography>
        </Stack>
      ) : null}
      {alert === undefined ? null : <ReasonAlert reason={alert} />}
      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(submitting) => (
          <Button
            type="submit"
            size="large"
            loading={submitting}
            loadingPosition="start"
          >
            {submitting ? m.ownership_saving() : m.ownership_save()}
          </Button>
        )}
      </form.Subscribe>
    </Stack>
  )
}
