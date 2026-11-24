// A tenancy's rent on the Tenancy page (Design canvas: Vuokrasuhde · vuokra
// ja muutokset; openspec: tenancies, "The tenancy page"): the rent in
// effect today, or the first rent of a tenancy that starts later, the next
// change and the changes newest first. Owners get the change link and the
// undo from the route.
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { periodOn, type Period } from '#/features/recurring-amounts/periods'
import { UndoButton } from '#/features/recurring-amounts/UndoDialog'
import { formatDate, formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import type { Tenancy } from './tenancy.repository.server'

interface Props {
  tenancy: Pick<Tenancy, 'validFrom'>
  /** Oldest first. */
  rents: readonly Period<number>[]
  today: string
  /** Owners only: the link to change the rent. */
  change?: ReactNode
  /** Owners only: undoing the latest change, offered with two periods. */
  onUndo?: () => void
}

export function RentCard(props: Props) {
  const { rents } = props
  // A tenancy that starts later shows its first rent.
  const day =
    props.today < props.tenancy.validFrom
      ? props.tenancy.validFrom
      : props.today
  const current = periodOn(rents, day)
  const upcoming = rents.find((p) => p.validFrom > day)
  return (
    <Stack
      component="section"
      aria-labelledby="rent-title"
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: `${String(radii.card)}px`,
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: 'center', gap: 1.5, px: 2, pt: 1.75, pb: 1.25 }}
      >
        <Stack sx={{ flex: 1, minWidth: 0, gap: 0.25 }}>
          <Typography
            id="rent-title"
            component="h2"
            variant="body2"
            sx={{ fontWeight: 800, color: 'text.secondary' }}
          >
            {m.tenancy_rent()}
          </Typography>
          <Typography sx={{ fontSize: 24, fontWeight: 900 }}>
            {current
              ? m.tenancy_rent_value({ amount: formatMoney(current.value) })
              : m.tenancy_rent_not_set()}
          </Typography>
          {current ? (
            <Typography variant="body2" color="text.secondary">
              {m.amounts_from({ date: formatDate(current.validFrom) })}
            </Typography>
          ) : null}
        </Stack>
        {props.change}
      </Stack>
      {upcoming ? (
        <Box
          sx={{
            mx: 2,
            mb: 1.25,
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
            amount: m.amounts_per_month({
              amount: formatMoney(upcoming.value),
            }),
          })}
        </Box>
      ) : null}
      {rents.length > 0 ? (
        <Box
          sx={{
            borderTop: `1px solid ${colors.cardBorder}`,
            bgcolor: 'background.default',
            px: 2,
            pb: props.onUndo && rents.length > 1 ? 0.5 : 0,
          }}
        >
          <Box
            component="ul"
            aria-label={m.tenancy_rent_changes()}
            sx={{ listStyle: 'none', m: 0, p: 0 }}
          >
            {[...rents].reverse().map((p) => (
              <Box
                component="li"
                key={p.validFrom}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: 44,
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
          {props.onUndo && rents.length > 1 ? (
            <UndoButton onClick={props.onUndo} />
          ) : null}
        </Box>
      ) : null}
    </Stack>
  )
}
