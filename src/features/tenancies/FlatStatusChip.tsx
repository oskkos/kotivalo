// A flat's tenancy status on its card on the flats list (Design canvas:
// Asunnot · vuokrasuhteen tila): Let, Notice given or Vacant, with the
// tenant's name (openspec: properties, "Listing flats").
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { formatDayMonth } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors } from '#/theme/tokens'
import type { CardTenancyStatus } from './tenancies.server'

export function FlatStatusChip(props: { status: CardTenancyStatus }) {
  const { status } = props
  const [bg, text] =
    status.kind === 'let'
      ? [colors.greenTint, m.tenancy_card_let()]
      : status.kind === 'notice_given'
        ? [
            colors.yellowTint,
            m.tenancy_status_notice_given({ date: formatDayMonth(status.on) }),
          ]
        : [
            colors.lavenderTint,
            status.nextStart === null
              ? m.tenancy_card_vacant()
              : m.tenancy_card_starts({
                  date: formatDayMonth(status.nextStart),
                }),
          ]
  return (
    <Stack
      direction="row"
      sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}
    >
      <Box
        component="span"
        sx={{
          bgcolor: bg,
          borderRadius: 999,
          px: 1.25,
          py: 0.25,
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        {text}
      </Box>
      {status.kind === 'vacant' ? null : (
        <Typography
          variant="caption"
          component="span"
          color="text.secondary"
          sx={{ fontWeight: 800 }}
        >
          {status.tenantName}
        </Typography>
      )}
    </Stack>
  )
}
