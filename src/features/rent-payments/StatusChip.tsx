// A month's rent status as a chip: an icon and text, never colour alone
// (Design canvas: Kuukauden vuokran tilat).
import Box from '@mui/material/Box'
import { colors } from '#/theme/tokens'
import { statusText, statusTone, type StatusTone } from './labels'
import type { RentStatus } from './status'

const CHECK = 'M5 12 L10 17 L19 7'
const CLOCK = 'M12 3 a9 9 0 1 0 0.01 0 M12 7 V12 L15 14'
const ALERT = 'M12 3 L22 20 H2 Z M12 10 V14 M12 17 V17.01'
const HALF = 'M12 3 a9 9 0 1 0 0.01 0 M12 3 V21'

const tones: Record<StatusTone, { bg: string; icon: string }> = {
  green: { bg: colors.greenTint, icon: CHECK },
  yellow: { bg: colors.yellowTint, icon: HALF },
  late: { bg: colors.lateTint, icon: ALERT },
  lavender: { bg: colors.lavenderTint, icon: CLOCK },
}

export function StatusChip(props: { status: RentStatus; text?: string }) {
  const tone = tones[statusTone(props.status)]
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        minHeight: 32,
        px: 1.5,
        borderRadius: 999,
        bgcolor: tone.bg,
        fontSize: 13,
        fontWeight: 900,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={tone.icon} />
      </svg>
      {props.text ?? statusText(props.status)}
    </Box>
  )
}
