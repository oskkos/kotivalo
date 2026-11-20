// The current owners and the ownership history (Design canvas:
// OmistusJakaminen), with undoing the latest change and correcting the first
// date for owners (spec: "Showing a flat's ownership history").
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm } from '@tanstack/react-form'
import { useState, type ReactNode } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { TextField } from '#/components/form/TextField'
import { clientLog } from '#/lib/client-log'
import { formatDate, formatShare } from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason, Reason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { correctFirstOwnershipDate, undoOwnershipChange } from './functions'
import { displayName, reasonLabel, splitText } from './labels'
import type { Period } from './periods'
import { typedDate } from './schemas'

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
  listStyle: 'none',
  m: 0,
  px: 2,
} as const

const row = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  '& + &': { borderTop: `1px solid ${colors.divider}` },
} as const

function Initial({ name, you }: { name: string; you: boolean }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 38,
        height: 38,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        bgcolor: you ? colors.yellow : colors.lavenderTint,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </Box>
  )
}

function Section(props: { title: string; children: ReactNode }) {
  return (
    <Stack component="section" sx={{ gap: 0.75 }}>
      <Typography variant="h4" component="h2" sx={{ fontWeight: 900 }}>
        {props.title}
      </Typography>
      {props.children}
    </Stack>
  )
}

interface Props {
  propertyId: string
  /** Newest first. */
  periods: readonly Period[]
  names: Readonly<Record<string, string>>
  you: string
  isOwner: boolean
  onChanged: () => Promise<void>
}

/** The current split, larger shares first. */
export function CurrentOwners({
  periods,
  names,
  you,
}: Pick<Props, 'periods' | 'names' | 'you'>) {
  const current = periods.at(0)
  if (!current) {
    return null
  }
  return (
    <Section title={m.ownership_current()}>
      <Box component="ul" sx={card}>
        {current.shares.map((share) => {
          const name = displayName(share.userId, names, you)
          return (
            <Box
              component="li"
              key={share.userId}
              sx={{ ...row, minHeight: 64 }}
            >
              <Initial name={name} you={share.userId === you} />
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" component="span">
                  {name}
                </Typography>
                <Typography
                  variant="body2"
                  component="span"
                  color="text.secondary"
                >
                  {m.ownership_owner_since({
                    date: formatDate(current.validFrom),
                  })}
                </Typography>
              </Stack>
              <Typography
                component="span"
                sx={{ fontWeight: 900, fontSize: 17 }}
              >
                {formatShare(share.share)}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Section>
  )
}

type Open = 'undo' | 'correct' | undefined

export function OwnershipHistory({
  propertyId,
  periods,
  names,
  you,
  isOwner,
  onChanged,
}: Props) {
  const [open, setOpen] = useState<Open>()
  const latest = periods.at(0)
  const previous = periods.at(1)
  const first = periods.at(-1)
  const close = () => {
    setOpen(undefined)
  }

  return (
    <Section title={m.ownership_history()}>
      <Box component="ul" sx={card}>
        {periods.map((period, i) => {
          const isFirst = i === periods.length - 1
          const note = [
            period.reason === null
              ? m.ownership_history_first()
              : reasonLabel(period.reason),
            ...(i === 0 ? [m.ownership_history_current()] : []),
          ].join(' · ')
          const action = !isOwner
            ? undefined
            : i === 0 && periods.length > 1
              ? { label: m.ownership_undo(), open: 'undo' as const }
              : isFirst
                ? { label: m.ownership_correct(), open: 'correct' as const }
                : undefined
          return (
            <Box
              component="li"
              key={period.validFrom}
              sx={{ ...row, alignItems: 'flex-start', py: 1.5 }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  width: 10,
                  height: 10,
                  mt: 0.75,
                  flexShrink: 0,
                  borderRadius: '50%',
                  border: `2px solid ${colors.plum}`,
                  bgcolor: i === 0 ? colors.plum : colors.white,
                }}
              />
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900 }}>
                  {m.ownership_history_from({
                    date: formatDate(period.validFrom),
                  })}
                </Typography>
                <Typography sx={{ fontWeight: 800 }}>
                  {splitText(period.shares, names, you)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {note}
                </Typography>
              </Stack>
              {action === undefined ? null : (
                <Button
                  variant="text"
                  color="inherit"
                  onClick={() => {
                    setOpen(action.open)
                  }}
                  sx={{ textDecoration: 'underline', flexShrink: 0 }}
                >
                  {action.label}
                </Button>
              )}
            </Box>
          )
        })}
      </Box>
      <Typography variant="body2" color="text.secondary">
        {m.ownership_history_footer()}
      </Typography>
      {latest && previous ? (
        <UndoDialog
          open={open === 'undo'}
          onClose={close}
          propertyId={propertyId}
          latest={latest}
          previous={previous}
          names={names}
          you={you}
          onChanged={onChanged}
        />
      ) : null}
      {first ? (
        <CorrectDateDialog
          open={open === 'correct'}
          onClose={close}
          propertyId={propertyId}
          first={first}
          next={periods.at(-2)}
          onChanged={onChanged}
        />
      ) : null}
    </Section>
  )
}

function UndoDialog(props: {
  open: boolean
  onClose: () => void
  propertyId: string
  latest: Period
  previous: Period
  names: Readonly<Record<string, string>>
  you: string
  onChanged: () => Promise<void>
}) {
  const [alert, setAlert] = useState<AlertReason>()
  const [busy, setBusy] = useState(false)

  async function undo() {
    setAlert(undefined)
    setBusy(true)
    try {
      const result = await undoOwnershipChange({
        data: { propertyId: props.propertyId },
      })
      if (result.ok) {
        await props.onChanged()
        props.onClose()
      } else {
        setAlert(result.reason)
      }
    } catch (error) {
      clientLog.error('ownership.undo_failed', {}, error)
      setAlert(failureReason(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      aria-labelledby="ownership-undo-title"
    >
      <DialogTitle
        id="ownership-undo-title"
        sx={{ fontSize: 20, fontWeight: 900, lineHeight: 1.3 }}
      >
        {m.ownership_undo_title({ date: formatDate(props.latest.validFrom) })}
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 1.5 }}>
          <DialogContentText>
            {m.ownership_undo_text({
              split: splitText(props.previous.shares, props.names, props.you),
              date: formatDate(props.previous.validFrom),
            })}
          </DialogContentText>
          {alert === undefined ? null : <ReasonAlert reason={alert} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" color="inherit" onClick={props.onClose}>
          {m.ownership_dialog_cancel()}
        </Button>
        <Button
          color="error"
          loading={busy}
          onClick={() => {
            void undo()
          }}
        >
          {m.ownership_undo()}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function CorrectDateDialog(props: {
  open: boolean
  onClose: () => void
  propertyId: string
  first: Period
  next: Period | undefined
  onChanged: () => Promise<void>
}) {
  const [alert, setAlert] = useState<AlertReason>()
  const [dateReason, setDateReason] = useState<Reason>()
  const form = useForm({
    defaultValues: { date: formatDate(props.first.validFrom) },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      setDateReason(undefined)
      try {
        const result = await correctFirstOwnershipDate({
          data: { propertyId: props.propertyId, date: value.date },
        })
        if (result.ok) {
          await props.onChanged()
          props.onClose()
        } else if (
          result.reason === 'ownership_date_in_future' ||
          result.reason === 'ownership_date_too_late' ||
          result.reason === 'date_invalid'
        ) {
          setDateReason(result.reason)
        } else {
          setAlert(result.reason as AlertReason)
        }
      } catch (error) {
        clientLog.error('ownership.correct_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      aria-labelledby="ownership-correct-title"
    >
      <Box
        component="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <DialogTitle
          id="ownership-correct-title"
          sx={{ fontSize: 20, fontWeight: 900, lineHeight: 1.3 }}
        >
          {m.ownership_correct_title()}
        </DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 1.5, pt: 1 }}>
            <form.Field
              name="date"
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
                  label={m.property_owned_since()}
                  placeholder={m.date_placeholder()}
                  fullWidth
                />
              )}
            </form.Field>
            {props.next === undefined ? null : (
              <Typography variant="body2" color="text.secondary">
                {m.ownership_correct_hint({
                  date: formatDate(props.next.validFrom),
                })}
              </Typography>
            )}
            {alert === undefined ? null : <ReasonAlert reason={alert} />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" color="inherit" onClick={props.onClose}>
            {m.ownership_dialog_cancel()}
          </Button>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(submitting) => (
              <Button type="submit" loading={submitting}>
                {m.ownership_correct_save()}
              </Button>
            )}
          </form.Subscribe>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
