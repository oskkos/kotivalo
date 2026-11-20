// The round initial of the signed-in user (Design canvas: AsunnotTili,
// TiliKevyt), in the accent colour.
import Box from '@mui/material/Box'
import { initialOf } from './initial'

export function AccountAvatar({ name, size }: { name: string; size: number }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        bgcolor: 'accent.main',
        color: 'accent.contrastText',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.4),
        fontWeight: 900,
      }}
    >
      {initialOf(name)}
    </Box>
  )
}
