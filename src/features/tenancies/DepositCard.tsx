// A tenancy's deposit on the Tenancy page (openspec: deposits, "The deposit
// on the tenancy page"): the amount and when it is returned, or that there
// is none. Owners get the link to the correction form from the route.
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'

interface Props {
  /** Cents; null or 0 when no deposit is set. */
  deposit: number | null | undefined
  /** Owners only: Change, or Add when no deposit is set. */
  action?: ReactNode
}

export function DepositCard(props: Props) {
  const set = props.deposit != null && props.deposit > 0
  return (
    <Stack
      component="section"
      aria-labelledby="deposit-title"
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: `${String(radii.card)}px`,
        gap: 0.75,
        px: 2,
        py: 1.75,
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
        <Typography
          id="deposit-title"
          component="h2"
          sx={{ flex: 1, fontSize: 15, fontWeight: 900 }}
        >
          {m.deposit_card_title()}
        </Typography>
        {props.action}
      </Stack>
      {set ? (
        <>
          <Typography sx={{ fontSize: 18, fontWeight: 900 }}>
            {formatMoney(props.deposit ?? 0)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {m.deposit_card_text()}
          </Typography>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {m.deposit_card_none()}
        </Typography>
      )}
    </Stack>
  )
}
