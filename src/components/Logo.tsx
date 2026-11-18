// The Kotivalo mark (a sun under a roof) and wordmark, from the Design canvas.
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { colors } from '#/theme/tokens'

export function LogoMark({
  size = 32,
  roof = colors.plum,
}: {
  size?: number
  /** The roof's colour; the decorative large mark uses lavender. */
  roof?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="38" r="20" fill={colors.yellow} />
      <path
        d="M11 31 L32 12 L53 31"
        fill="none"
        stroke={roof}
        strokeWidth={roof === colors.plum ? 6 : 4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The mark with the name "kotivalo"; the name is the accessible text. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
      <LogoMark size={size} />
      <Typography
        component="span"
        sx={{
          fontSize: size * 0.7,
          fontWeight: 900,
          letterSpacing: '-0.035em',
        }}
      >
        kotivalo
      </Typography>
    </Stack>
  )
}
