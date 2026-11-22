// This month's rent across the user's flats, at the top of the flats list
// (Design canvas: Asunnot · vuokran tila; openspec: rent-payments, "The rent
// summary on the flats list"): received out of expected, whole rents, and
// how many flats are late.
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useId } from 'react'
import { formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { rentSummaryTitle } from './labels'

interface Props {
  /** `YYYY-MM`. */
  month: string
  /** Cents. */
  received: number
  /** Cents. */
  expected: number
  /** Flats whose rent is late. */
  late: number
}

export function RentSummary(props: Props) {
  const titleId = useId()
  const share = Math.min(1, props.received / Math.max(1, props.expected))
  return (
    <Stack
      component="section"
      aria-labelledby={titleId}
      sx={{
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        borderRadius: `${String(radii.hero)}px`,
        px: 2.25,
        py: 2,
        gap: 1,
      }}
    >
      <Typography
        id={titleId}
        component="h2"
        sx={{ fontSize: 13, fontWeight: 800, color: colors.onPlumMuted }}
      >
        {rentSummaryTitle(props.month)}
      </Typography>
      <Typography
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          columnGap: 1,
        }}
      >
        <Box
          component="span"
          sx={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1 }}
        >
          {formatMoney(props.received)}
        </Box>{' '}
        <Box
          component="span"
          sx={{ fontSize: 15, fontWeight: 800, color: colors.onPlumMuted }}
        >
          {m.rent_summary_of_expected({
            expected: formatMoney(props.expected),
          })}
        </Box>
      </Typography>
      <Box
        aria-hidden="true"
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: colors.onPlumTint,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: `${String(Math.round(share * 100))}%`,
            height: 8,
            borderRadius: 4,
            bgcolor: 'accent.main',
          }}
        />
      </Box>
      {props.late > 0 ? (
        <Typography
          sx={{ fontSize: 13, fontWeight: 700, color: colors.onPlumMuted }}
        >
          {m.rent_summary_late({ count: props.late })}
        </Typography>
      ) : null}
    </Stack>
  )
}
