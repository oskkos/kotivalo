// A tenancy's occupants on the Tenancy page (openspec: tenancies, "The
// tenancy page", "Changing the occupants"): the number in effect today, or
// the first when the tenancy starts later, the next upcoming change and when
// the latest started. Owners get the change button and the undo.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { periodOn, type Period } from '#/features/recurring-amounts/periods'
import { UndoButton } from '#/features/recurring-amounts/UndoDialog'
import { formatDate } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'

interface Props {
  tenancy: { validFrom: string }
  /** Oldest first. */
  occupants: readonly Period<number>[]
  today: string
  /** Owners only: opens the change dialog. */
  onChange?: () => void
  /** Owners only: undoing the latest change, offered with two periods. */
  onUndo?: () => void
}

export function OccupantsCard(props: Props) {
  const { occupants } = props
  const day =
    props.today < props.tenancy.validFrom
      ? props.tenancy.validFrom
      : props.today
  const current = periodOn(occupants, day)
  const upcoming = occupants.find((p) => p.validFrom > day)
  const latest = occupants.at(-1)
  return (
    <Stack
      component="section"
      aria-labelledby="occupants-title"
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: `${String(radii.card)}px`,
        px: 2,
        py: 1.5,
        gap: 0.75,
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            id="occupants-title"
            component="h2"
            variant="body2"
            sx={{ fontWeight: 800, color: 'text.secondary' }}
          >
            {m.tenancy_occupants()}
          </Typography>
          <Typography sx={{ fontSize: 24, fontWeight: 900 }}>
            {current ? String(current.value) : '–'}
          </Typography>
          {latest ? (
            <Typography variant="body2" color="text.secondary">
              {m.amounts_from({ date: formatDate(latest.validFrom) })}
            </Typography>
          ) : null}
        </Stack>
        {props.onChange ? (
          <Button
            variant="outlined"
            onClick={props.onChange}
            aria-label={m.tenancy_occupants_change_label()}
            sx={{ minHeight: 44, px: 2, flexShrink: 0 }}
          >
            {m.amounts_change()}
          </Button>
        ) : null}
      </Stack>
      {upcoming ? (
        <Box
          sx={{
            bgcolor: colors.yellowTint,
            borderRadius: `${String(radii.input)}px`,
            px: 1.5,
            py: 1,
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {m.amounts_upcoming({
            date: formatDate(upcoming.validFrom),
            amount: String(upcoming.value),
          })}
        </Box>
      ) : null}
      {props.onUndo && occupants.length > 1 ? (
        <UndoButton onClick={props.onUndo} />
      ) : null}
    </Stack>
  )
}
